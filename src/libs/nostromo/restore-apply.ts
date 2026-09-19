/**
 * Apply half of the Nostromo restore: write what the user decided after reading
 * a plan.
 *
 * - `applyNostromoRestore()` pulls the remote state over the local one: every
 *   collection unit of the plan is read back and applied to its store, every
 *   remote photo is downloaded, and every local photo the server does not know
 *   about is deleted,
 * - `applyNostromoOverwrite()` force-pushes the local state over the remote
 *   documents: the "keep my version" answer to a conflict,
 * - `confirmNostromoRestore()` runs the decision the user made.
 *
 * Hard rules this module keeps:
 *
 * - a pull does not push: the store mutations mark their unit dirty (the marks
 *   live in the store persist funnels), so the restored units are dropped from
 *   the outbox after the LAST local write of the run, and the debounce those
 *   marks armed is cancelled,
 * - a per-unit failure is logged and skipped; only a refused session (401)
 *   aborts a run, and even then the units already written are settled first,
 * - a photo that is pulled or deleted keeps the `hasPhoto` flag of its player in
 *   sync with the blob store, through the canonical flag-aware helpers.
 */
import { batch } from 'solid-js'

import {
  deletePhoto,
  deletePhotoAndFlag,
  getPhoto,
  PHOTO_FILE_EXTENSION,
  setPhotoAndFlag,
  storePhoto,
} from '../photo-store/photo-store'
import Player from '../player/player'
import { getPlayerById, updatePlayer } from '../stores/players-store'
import {
  createDocument,
  downloadFile,
  getDocument,
  getFileToken,
  NostromoClientError,
  photoDocId,
  updateDocument,
  uploadDocumentFile,
} from './client'
import type { NostromoDocument } from './client.d'
import { cancelDirtyDebounce } from './dirty-marks'
import type { NostromoConfig } from './nostromo-config-store.d'
import {
  clearBaseline,
  getDirtyUnits,
  pushNostromoLog,
  setBaselines,
  setDirtyUnits,
  setNostromoSyncStatus,
} from './nostromo-sync-store'
import type { NostromoStatus, NostromoUnitName } from './nostromo-sync-store.d'
import { buildPhotoPayload, describeError, readCollectionPayload, type ValidCollectionRead } from './payload'
import { NOSTROMO_MAX_PHOTO_BYTES, resolveNostromoConflict } from './push-engine'
import type {
  NostromoCollectionPlanUnit,
  NostromoPhotoPlanUnit,
  NostromoRestoreDecision,
  NostromoRestorePlan,
  NostromoRestorePlanUnit,
  NostromoRestoreResult,
} from './restore.d'
import { isAuthError, requireConfig } from './restore-plan'
import { applyCollectionPayload, buildUnitPayload, collectionDocId } from './units'

/** A collection unit read from the server, waiting to be applied to its store. */
interface PendingCollectionUnit {
  docId: string
  /** Payload that passed the runtime guard, in the shape of its unit. */
  read: ValidCollectionRead
  unit: NostromoUnitName
  version: number
}

/** A baseline to write once a unit is fully restored. */
interface BaselineUpdate {
  docId: string
  unit: string
  version: number
}

/**
 * Runs the decision the user made after reading a plan: `pull` applies the
 * remote state, `overwrite` force-pushes the local state, `cancel` returns
 * `undefined` without touching anything. An auth failure of either apply path
 * propagates, as does a failure to list the remote documents.
 */
export async function confirmNostromoRestore(
  plan: NostromoRestorePlan,
  decision: NostromoRestoreDecision
): Promise<NostromoRestoreResult | undefined> {
  if (decision === 'cancel') {
    pushNostromoLog('info', "Restauration Nostromo : annulée par l'utilisateur, rien n'a été écrit.")
    return undefined
  }
  if (plan.requiresConfirmation) {
    pushNostromoLog(
      'info',
      `Restauration Nostromo : l'utilisateur a confirmé un plan portant ${plan.warnings.length} avertissements.`
    )
  }
  if (decision === 'pull') {
    return await applyNostromoRestore(plan)
  }
  return await applyNostromoOverwrite(plan)
}

/**
 * Pulls the remote state over the local one: every collection unit of the plan
 * is read back and applied to its store, every remote photo is downloaded, and
 * every local photo the server does not know about is deleted.
 *
 * The plan is assumed to have been confirmed by the user: the deletion of local
 * photos happens here without asking again, which is why `planNostromoRestore()`
 * flags it. A refused session (401) sets the status to `auth-required` and
 * propagates; every other failure stays inside the returned result.
 */
export async function applyNostromoRestore(plan: NostromoRestorePlan): Promise<NostromoRestoreResult> {
  const config = requireConfig()
  const dirtyBefore = getDirtyUnits()
  const report = createApplyReport()

  setNostromoSyncStatus('saving')
  pushNostromoLog('info', "Restauration Nostromo : reprise des documents distants sur l'état local.")
  // A debounce armed by an earlier local change is about to push units this run
  // replaces: drop it before the first write.
  cancelDirtyDebounce()

  try {
    await pullCollectionUnits(config, plan, report)
    await pullPhotoUnits(config, plan, report)
  } catch (error) {
    // A run aborted by a refused session still settles what it already wrote:
    // an applied unit without its baseline answers 409 on the next push, and the
    // user would have to resolve a conflict this run created itself.
    settleRestoredUnits(report)
    throw error
  }
  settleRestoredUnits(report)

  setNostromoSyncStatus(resultStatus(false, report.failed.length))
  pushNostromoLog(
    'info',
    `Restauration Nostromo : ${report.applied.length} éléments repris, ${report.deletedPhotos.length} photos supprimées, ${report.skipped.length} ignorés, ${report.failed.length} en échec.`
  )
  if (dirtyBefore.length > 0) {
    pushNostromoLog(
      'warn',
      "Restauration Nostromo : des changements étaient en attente d'envoi avant la reprise ; un envoi a pu s'exécuter pendant la restauration."
    )
  }
  return createRestoreResult(report)
}

/**
 * Force-pushes the local state over the remote documents, for the units the plan
 * covers: the "keep my version" answer to a conflict. A unit is written with the
 * version the plan read, so a server that moved again since the plan answers 409
 * and the unit keeps its local data: only the user-confirmed overwrite may force
 * over a newer remote copy, and never a version it never saw. Local photos are
 * never deleted here (the remote copy of a photo this device no longer holds is
 * left in place).
 *
 * Only the units that still have something to force are written: a unit the
 * server never saw and that holds nothing locally, and a unit whose baseline
 * already matches the remote version, are reported as skipped. A refused
 * session (401) sets the status to `auth-required`, settles the units already
 * written and propagates.
 */
export async function applyNostromoOverwrite(plan: NostromoRestorePlan): Promise<NostromoRestoreResult> {
  const config = requireConfig()
  const report = createApplyReport()

  setNostromoSyncStatus('saving')
  pushNostromoLog('info', 'Écrasement Nostromo : envoi des données locales sur les documents distants.')
  cancelDirtyDebounce()

  let conflicted = false
  try {
    conflicted = await overwriteCollectionUnits(config, plan, report)
    conflicted = (await overwritePhotoUnits(config, plan, report)) || conflicted
  } catch (error) {
    // Same rule as the pull: what was already pushed is settled before the
    // refusal propagates, so no unit is left with a baseline the server moved past.
    settleRestoredUnits(report)
    throw error
  }
  settleRestoredUnits(report)

  setNostromoSyncStatus(resultStatus(conflicted, report.failed.length))
  pushNostromoLog(
    'info',
    `Écrasement Nostromo : ${report.applied.length} éléments envoyés, ${report.skipped.length} ignorés, ${report.failed.length} en échec.`
  )
  return createRestoreResult(report)
}

/** Accumulator of one apply run, shared by its phases. */
interface ApplyReport {
  applied: string[]
  baselines: BaselineUpdate[]
  /** Photos deleted locally because the server holds no copy: the pull path only. */
  deletedPhotos: string[]
  failed: string[]
  skipped: string[]
}

function createApplyReport(): ApplyReport {
  return { applied: [], baselines: [], deletedPhotos: [], failed: [], skipped: [] }
}

function createRestoreResult(report: ApplyReport): NostromoRestoreResult {
  return {
    appliedUnits: [...report.applied],
    deletedPhotoUnits: [...report.deletedPhotos],
    failedUnits: [...report.failed],
    skippedUnits: [...report.skipped],
  }
}

/** Status a finished run leaves: the worst thing that happened wins. */
function resultStatus(hasConflict: boolean, failedCount: number): NostromoStatus {
  if (hasConflict) {
    return 'conflict'
  }
  return failedCount > 0 ? 'error' : 'saved'
}

/** Reads the remote collections back and applies them to their stores. */
async function pullCollectionUnits(
  config: NostromoConfig,
  plan: NostromoRestorePlan,
  report: ApplyReport
): Promise<void> {
  const pending = await readCollectionUnits(config, plan, report)
  const asyncPersists: Promise<void>[] = []

  // The five reactive collections are written in one batch so the UI never
  // renders a half-restored state. Trombi titles is the only unit whose store
  // persists asynchronously: its write happens here too, the promise it returns
  // only covers the storage write that follows.
  batch(() => {
    for (const pendingUnit of pending) {
      applyPendingCollectionUnit(pendingUnit, report, asyncPersists)
    }
  })
  await settleAsyncPersists(asyncPersists)
}

/** Applies one read-back collection unit to its store, inside the batch. */
function applyPendingCollectionUnit(
  pendingUnit: PendingCollectionUnit,
  report: ApplyReport,
  asyncPersists: Promise<void>[]
): void {
  try {
    const persist = applyCollectionPayload(pendingUnit.read)
    if (persist) {
      asyncPersists.push(persist)
    }
    report.baselines.push({ docId: pendingUnit.docId, unit: pendingUnit.unit, version: pendingUnit.version })
    report.applied.push(pendingUnit.unit)
  } catch (error) {
    pushNostromoLog(
      'error',
      `Restauration Nostromo : l'application de ${pendingUnit.unit} a échoué : ${describeError(error)}`
    )
    report.failed.push(pendingUnit.unit)
  }
}

/** Downloads the remote photos and deletes the local ones the server does not know about. */
async function pullPhotoUnits(config: NostromoConfig, plan: NostromoRestorePlan, report: ApplyReport): Promise<void> {
  for (const photoUnit of plan.photoUnits) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one download at a time, each with its own file token, and a 401 aborts the remaining units.
      const outcome = await pullPhotoUnit(config, photoUnit)
      if (outcome === 'deleted') {
        report.deletedPhotos.push(photoUnit.unit)
        continue
      }
      if (outcome === 'skipped') {
        report.skipped.push(photoUnit.unit)
        continue
      }
      report.baselines.push({ docId: outcome.docId, unit: photoUnit.unit, version: outcome.version })
      report.applied.push(photoUnit.unit)
    } catch (error) {
      rethrowIfAuth(error, photoUnit.unit)
      pushNostromoLog(
        'error',
        `Restauration Nostromo : la restauration de ${photoUnit.unit} a échoué : ${describeError(error)}`
      )
      report.failed.push(photoUnit.unit)
    }
  }
}

/** Force-pushes every collection unit of the plan, and tells whether one hit a 409. */
async function overwriteCollectionUnits(
  config: NostromoConfig,
  plan: NostromoRestorePlan,
  report: ApplyReport
): Promise<boolean> {
  let conflicted = false

  for (const unitPlan of plan.collectionUnits) {
    const skipReason = collectionOverwriteSkipReason(unitPlan)
    if (skipReason) {
      report.skipped.push(unitPlan.unit)
      pushNostromoLog('info', `Écrasement Nostromo : ${unitPlan.unit} ignoré (${skipReason}).`)
      continue
    }
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one document per unit, written in plan order, and a 401 aborts the remaining units.
      const document = await forceWriteCollection(config, unitPlan.unit, resolveOverwriteTarget(unitPlan))
      report.baselines.push({ docId: document.id, unit: unitPlan.unit, version: document.version })
      report.applied.push(unitPlan.unit)
    } catch (error) {
      rethrowIfAuth(error, unitPlan.unit)
      conflicted = reportOverwriteFailure(unitPlan.unit, error) || conflicted
      report.failed.push(unitPlan.unit)
    }
  }

  return conflicted
}

/** Force-pushes every photo unit of the plan, and tells whether one hit a 409. */
async function overwritePhotoUnits(
  config: NostromoConfig,
  plan: NostromoRestorePlan,
  report: ApplyReport
): Promise<boolean> {
  let conflicted = false

  for (const photoPlan of plan.photoUnits) {
    const skipReason = photoOverwriteSkipReason(photoPlan)
    if (skipReason) {
      report.skipped.push(photoPlan.unit)
      pushNostromoLog('info', `Écrasement Nostromo : ${photoPlan.unit} ignoré (${skipReason}).`)
      continue
    }
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one upload at a time keeps a large photo's memory bounded, and a 401 aborts the remaining units.
      const outcome = await forceWritePhotoUnit(config, photoPlan)
      if (outcome === 'failed') {
        report.failed.push(photoPlan.unit)
        continue
      }
      if (outcome === 'skipped') {
        report.skipped.push(photoPlan.unit)
        continue
      }
      report.baselines.push({ docId: outcome.docId, unit: photoPlan.unit, version: outcome.version })
      report.applied.push(photoPlan.unit)
    } catch (error) {
      rethrowIfAuth(error, photoPlan.unit)
      conflicted = reportOverwriteFailure(photoPlan.unit, error) || conflicted
      report.failed.push(photoPlan.unit)
    }
  }

  return conflicted
}

/**
 * Closes a run: the units it applied leave the outbox (the store mutations
 * marked them dirty, a mark that describes a change this run just replaced),
 * their baselines are written from the versions the server returned, and any
 * conflict parked on them is resolved. Runs after the LAST local write, and also
 * on the way out of an aborted run, so a written unit is never left with a stale
 * baseline.
 */
function settleRestoredUnits(report: ApplyReport): void {
  const settled = new Set([...report.applied, ...report.deletedPhotos])
  cancelDirtyDebounce()

  // One grouped write for the whole run: every baseline is persisted in a single
  // storage write, once the last local write of the run is behind us.
  const savedAt = Date.now()
  setBaselines(report.baselines.map(({ docId, unit, version }) => ({ baseline: { docId, savedAt, version }, unit })))
  for (const unit of settled) {
    resolveNostromoConflict(unit)
  }
  dropRestoredFromOutbox(settled)
}

/** Reads back every collection unit of the plan, keeping only the ones that can be applied. */
async function readCollectionUnits(
  config: NostromoConfig,
  plan: NostromoRestorePlan,
  report: ApplyReport
): Promise<PendingCollectionUnit[]> {
  const pending: PendingCollectionUnit[] = []

  for (const unitPlan of plan.collectionUnits) {
    if (!unitPlan.remote) {
      report.skipped.push(unitPlan.unit)
      continue
    }
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one document per unit, read in plan order, and a 401 aborts the remaining units.
      const document = await getDocument(config.baseUrl, config.token, unitPlan.remote.docId)
      const read = readCollectionPayload(document.payload, unitPlan.unit)
      if (read.kind === 'invalid') {
        pushNostromoLog(
          'error',
          `Restauration Nostromo : la charge utile de ${unitPlan.unit} est inutilisable (${read.reason}), l'élément est ignoré.`
        )
        report.skipped.push(unitPlan.unit)
        continue
      }
      pending.push({ docId: document.id, read, unit: unitPlan.unit, version: document.version })
    } catch (error) {
      rethrowIfAuth(error, unitPlan.unit)
      pushNostromoLog(
        'error',
        `Restauration Nostromo : la lecture de ${unitPlan.unit} a échoué : ${describeError(error)}`
      )
      report.failed.push(unitPlan.unit)
    }
  }

  return pending
}

/** What pulling one photo unit ended with. */
type PhotoPullOutcome = 'deleted' | 'skipped' | { docId: string; version: number }

/**
 * Pulls one photo unit: a remote copy is downloaded into the local store, a
 * local copy the server does not know about is deleted, and a unit already in
 * sync is left alone.
 */
async function pullPhotoUnit(config: NostromoConfig, photoUnit: NostromoPhotoPlanUnit): Promise<PhotoPullOutcome> {
  const { deletionRequired, playerId, remote, unit } = photoUnit
  if (!remote) {
    if (!deletionRequired) {
      return 'skipped'
    }
    await deletePulledPhoto(playerId)
    clearBaseline(unit)
    pushNostromoLog('info', `Restauration Nostromo : la photo locale du joueur ${playerId} a été supprimée.`)
    return 'deleted'
  }

  if (photoUnit.upToDate || !remote.file) {
    return 'skipped'
  }

  // The baseline must carry the version the server holds at apply time, not the
  // one the plan froze: re-read it BEFORE the download, exactly like the
  // collection path does, so the baseline never ends up ahead of the blob.
  const fresh = await getDocument(config.baseUrl, config.token, remote.docId)

  // A file token lives about 180 seconds: mint a fresh one per download and
  // never reuse it across files.
  const fileToken = await getFileToken(config.baseUrl, config.token)
  const blob = await downloadFile(config.baseUrl, fileToken, remote.docId, remote.file)
  await storePulledPhoto(playerId, blob)
  pushNostromoLog('info', `Restauration Nostromo : photo du joueur ${playerId} reprise.`)
  return { docId: fresh.id, version: fresh.version }
}

/**
 * Stores a pulled photo and keeps the `hasPhoto` flag of its player in sync with
 * the blob. The flag helpers are the canonical ones and take a `Player`, so the
 * player is read from its store, flagged, then written back through the same
 * store function every player edition uses. A photo whose player is not in the
 * local collection has no flag to update: only the blob is written.
 */
async function storePulledPhoto(playerId: string, blob: Blob): Promise<void> {
  const player = readLocalPlayer(playerId)
  if (!player) {
    await storePhoto(playerId, blob)
    return
  }
  await setPhotoAndFlag(player, blob)
  updatePlayer(playerId, player.getRawData())
}

/** Deletes a photo the server does not know about, and clears the flag of its player. */
async function deletePulledPhoto(playerId: string): Promise<void> {
  const player = readLocalPlayer(playerId)
  if (!player) {
    await deletePhoto(playerId)
    return
  }
  await deletePhotoAndFlag(player)
  updatePlayer(playerId, player.getRawData())
}

function readLocalPlayer(playerId: string): Player | undefined {
  const raw = getPlayerById(playerId)
  return raw ? new Player(raw) : undefined
}

/** What force-pushing one photo ended with. */
type PhotoOverwriteOutcome = 'failed' | 'skipped' | { docId: string; version: number }

/** Force-pushes one photo unit, unless the local copy is missing or matches the remote version. */
async function forceWritePhotoUnit(
  config: NostromoConfig,
  photoPlan: NostromoPhotoPlanUnit
): Promise<PhotoOverwriteOutcome> {
  const blob = await getPhoto(photoPlan.playerId)
  if (!blob) {
    pushNostromoLog(
      'warn',
      `Écrasement Nostromo : la photo du joueur ${photoPlan.playerId} n'est pas stockée localement, l'élément est ignoré.`
    )
    return 'skipped'
  }
  if (blob.size > NOSTROMO_MAX_PHOTO_BYTES) {
    pushNostromoLog(
      'error',
      `Écrasement Nostromo : la photo du joueur ${photoPlan.playerId} pèse ${blob.size} octets, au-dessus de la limite de ${NOSTROMO_MAX_PHOTO_BYTES} octets, l'élément est ignoré.`
    )
    return 'failed'
  }

  const document = await forceWritePhoto(config, photoPlan, blob)
  return { docId: document.id, version: document.version }
}

/** Writes one collection unit unconditionally, creating its document when the server holds none. */
async function forceWriteCollection(
  config: NostromoConfig,
  unit: NostromoUnitName,
  target: OverwriteTarget
): Promise<NostromoDocument> {
  const payload = buildUnitPayload(unit)
  if (target.kind === 'update') {
    return await updateDocument(config.baseUrl, config.token, target.docId, {
      expectedVersion: target.expectedVersion,
      payload,
    })
  }
  // The id is derived from the unit name, exactly like the push engine does: a
  // create can never duplicate an existing document.
  return await createDocument(config.baseUrl, config.token, {
    id: collectionDocId(unit),
    owner: config.userId,
    payload,
  })
}

/** Writes one photo unit unconditionally: payload first, then the image file. */
async function forceWritePhoto(
  config: NostromoConfig,
  photoPlan: NostromoPhotoPlanUnit,
  blob: Blob
): Promise<NostromoDocument> {
  const { playerId } = photoPlan
  const { docId, version } = await writePhotoPayload(config, playerId, resolveOverwriteTarget(photoPlan))

  // The upload bumps the version again: the returned value is the one to keep.
  return await uploadDocumentFile(config.baseUrl, config.token, docId, {
    expectedVersion: version,
    file: blob,
    filename: `${playerId}${PHOTO_FILE_EXTENSION}`,
  })
}

/** Writes the payload of a photo document and returns the version the file upload must expect. */
async function writePhotoPayload(
  config: NostromoConfig,
  playerId: string,
  target: OverwriteTarget
): Promise<{ docId: string; version: number }> {
  const payload = buildPhotoPayload(playerId)
  if (target.kind === 'create') {
    const docId = photoDocId(playerId)
    const created = await createDocument(config.baseUrl, config.token, { id: docId, owner: config.userId, payload })
    return { docId, version: created.version }
  }

  const { docId, expectedVersion } = target
  const updated = await updateDocument(config.baseUrl, config.token, docId, { expectedVersion, payload })
  return { docId, version: updated.version }
}

/** Where a force-push must write: an existing document and its expected version, or a create. */
interface OverwriteCreateTarget {
  kind: 'create'
}

interface OverwriteUpdateTarget {
  docId: string
  expectedVersion: number
  kind: 'update'
}

type OverwriteTarget = OverwriteCreateTarget | OverwriteUpdateTarget

/**
 * Which write a force-push needs.
 *
 * The plan carries the last version the server READ returned, and that is the
 * token the overwrite sends: the user just confirmed a plan naming it, so the
 * stale baseline must not refuse the very write that resolves the conflict. A
 * create is only needed for a unit the server never saw.
 */
function resolveOverwriteTarget(unitPlan: NostromoRestorePlanUnit): OverwriteTarget {
  const { localBaseline, remote } = unitPlan
  if (remote && (!localBaseline || localBaseline.docId === remote.docId)) {
    return { docId: remote.docId, expectedVersion: remote.version, kind: 'update' }
  }
  if (localBaseline) {
    return { docId: localBaseline.docId, expectedVersion: localBaseline.version, kind: 'update' }
  }
  return { kind: 'create' }
}

/** Why a collection unit has nothing to force-push, `undefined` when it has something to push. */
function collectionOverwriteSkipReason(unitPlan: NostromoCollectionPlanUnit): string | undefined {
  const { localBaseline, localCount, localDirty, remote } = unitPlan
  if (!(remote || localBaseline) && localCount === 0) {
    return 'le serveur ne détient aucun document et la collection locale est vide'
  }
  if (
    remote &&
    localBaseline &&
    !localDirty &&
    localBaseline.docId === remote.docId &&
    localBaseline.version === remote.version
  ) {
    return 'la copie locale correspond déjà à la version distante'
  }
  return undefined
}

/** Why a photo unit has nothing to force-push, `undefined` when it has something to push. */
function photoOverwriteSkipReason(photoPlan: NostromoPhotoPlanUnit): string | undefined {
  if (!photoPlan.localPhotoExists) {
    return 'aucune copie locale à envoyer'
  }
  if (photoPlan.upToDate) {
    return 'la copie locale correspond déjà à la version distante'
  }
  return undefined
}

/** Report of one failed force-push: true when the server refused the write as a conflict. */
function reportOverwriteFailure(unit: string, error: unknown): boolean {
  if (error instanceof NostromoClientError && error.kind === 'conflict') {
    pushNostromoLog(
      'error',
      `Écrasement Nostromo : la copie du serveur de ${unit} a dépassé la référence locale, l'élément n'est pas modifié.`
    )
    return true
  }
  pushNostromoLog('error', `Écrasement Nostromo : l'envoi de ${unit} a échoué : ${describeError(error)}`)
  return false
}

/** Reports a refused session once and rethrows it: every other failure is a per-unit failure. */
function rethrowIfAuth(error: unknown, unit: string): void {
  if (!isAuthError(error)) {
    return
  }
  pushNostromoLog(
    'error',
    `Nostromo : la session a été refusée pendant la synchronisation de ${unit}, reconnectez-vous.`
  )
  setNostromoSyncStatus('auth-required')
  throw error
}

/** Removes the restored units from the outbox in a single write, when there is something to remove. */
function dropRestoredFromOutbox(restored: ReadonlySet<string>): void {
  const current = getDirtyUnits()
  const remaining = current.filter((unit) => !restored.has(unit))
  if (remaining.length === current.length) {
    return
  }
  setDirtyUnits(remaining)
  pushNostromoLog(
    'info',
    `Restauration Nostromo : ${current.length - remaining.length} élément(s) restauré(s) retiré(s) de la file d'attente.`
  )
}

/**
 * Awaits the persists a unit store returned. Only `trombiTitles` has one: the
 * store write already happened inside the batch, the promise covers the storage
 * write that follows, whose failure must not fail the restore.
 */
async function settleAsyncPersists(persists: Promise<void>[]): Promise<void> {
  for (const persist of persists) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: the writes are awaited one by one so one failure never cancels the others.
      await persist
    } catch (error) {
      pushNostromoLog(
        'error',
        `Restauration Nostromo : l'enregistrement d'une collection restaurée a échoué : ${describeError(error)}`
      )
    }
  }
}
