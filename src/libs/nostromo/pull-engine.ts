/**
 * Pull half of the Nostromo synchronization: bring the server state into the
 * local stores, one document per collection unit.
 *
 * Shape of a run (`pullNostromo`):
 *
 * - the session is checked, then the outbox is drained through the push engine:
 *   a pull never runs over unsent local work and never over a parked unit,
 * - the remote documents are listed once, and a unit is applied only when its
 *   remote `version` is greater than the baseline version (or when it has no
 *   baseline yet),
 * - every payload is validated BEFORE any store is touched: one invalid payload
 *   aborts the whole pull and commits nothing,
 * - the validated units are committed in one `batch()` through the silent apply,
 *   which never marks a unit dirty, then their baselines are written in one go.
 *
 * Deletions follow four rules, nothing implicit:
 *
 * 1. An item deleted inside a collection travels with the whole document: the
 *    next pull applies the new list, there are no tombstones. Last writer wins
 *    at collection level, and concurrent edits go through the conflict policy.
 * 2. A photo whose remote document is gone, while the photo unit is clean, is
 *    deleted locally and its baseline cleared. A dirty photo is never deleted:
 *    the push recreates it.
 * 3. A collection whose remote document is gone, while the unit is clean, keeps
 *    its local data: only the baseline is cleared so the next push recreates it.
 * 4. A document is only treated as gone after one re-list: never a loop, never
 *    a local deletion on a single answer.
 *
 * Photos: a remote photo document newer than its baseline is downloaded and stored
 * after the collections are committed, then `hasPhoto` is reconciled from the photo
 * store. A dirty photo is never overwritten by a download.
 *
 * A pull whose plan was overtaken during its awaits (a baseline moved, a unit
 * dirtied) aborts before committing anything: the next pull relists the server.
 */
import { batch } from 'solid-js'

import { deletePhoto, storePhoto } from '../photo-store/photo-store'
import { storePlayers } from '../store/store'
import { removeOrphanContacts } from '../stores/contacts-store'
import { getRawPlayers, hydratePlayers } from '../stores/players-store'
import { ensureFreshSession } from './auth-session'
import { getDocument, NostromoClientError } from './client'
import type { NostromoDocument } from './client.d'
import { cancelDirtyDebounce, markCollectionDirty, PHOTO_UNIT_PREFIX, photoUnitName } from './dirty-marks'
import { listAllRemoteDocuments } from './listing'
import { getConfig } from './nostromo-config-store'
import type { NostromoConfig } from './nostromo-config-store.d'
import {
  clearBaseline,
  clearUnitDirtyIfUnchanged,
  getAllBaselines,
  getBaseline,
  getConflictedUnits,
  getDirtyRevision,
  getDirtyUnits,
  getNostromoSyncStatus,
  isUnitDirty,
  pushNostromoLog,
  setBaseline,
  setBaselines,
  setNostromoSyncStatus,
} from './nostromo-sync-store'
import type { NostromoBaselineUpdate, NostromoStatus, NostromoUnitName } from './nostromo-sync-store.d'
import {
  describeError,
  readCollectionPayload,
  readPhotoPayload,
  toPayloadRecord,
  type ValidCollectionRead,
} from './payload'
import { createFileTokenSession, downloadPhoto, type FileTokenSession, reconcileHasPhoto } from './photo-sync'
import type { NostromoPullOptions, NostromoPullSkipReason, PullOutcome } from './pull-engine.d'
import { flushNostromoPush, isPushBackoffActive } from './push-engine'
import { notifySyncFailure } from './sync-notify'
import { applyCollectionPayloadSilently, isCollectionUnitName, NOSTROMO_PLAN_ORDER } from './units'

let pullInFlight: Promise<PullOutcome> | undefined

/** The photo store marks a unit exactly once per write or delete (see `markPhotoDirty`). */
const PHOTO_STORE_MARK_REVISIONS = 1

/**
 * Pulls the remote collections into the local stores. Never throws: every
 * failure is logged and mapped to an outcome. Concurrent calls share one run.
 */
export function pullNostromo(options: NostromoPullOptions = {}): Promise<PullOutcome> {
  if (pullInFlight) {
    return pullInFlight
  }
  const run = runPull(options).finally(() => {
    pullInFlight = undefined
  })
  pullInFlight = run
  return run
}

interface PullCandidate {
  document: NostromoDocument
  unit: NostromoUnitName
}

interface PullPlan {
  /** Units that have a baseline but no remote document: the seam of the deletion propagation. */
  missing: NostromoUnitName[]
  toApply: PullCandidate[]
}

interface PhotoCandidate {
  document: NostromoDocument
  playerId: string
  unit: string
}

/** Baseline version of each planned unit, read before the awaits of the pull. */
type BaselineVersions = ReadonlyMap<string, number | undefined>

async function runPull(options: NostromoPullOptions): Promise<PullOutcome> {
  const blocked = await prepareSession(options)
  if (blocked) {
    return blocked
  }
  const config = getConfig()
  if (!config) {
    return skipped('unconfigured')
  }

  setNostromoSyncStatus('saving')
  try {
    return await pullFromServer(config, options)
  } catch (error) {
    return failPull(error)
  }
}

/** Session check then outbox drain. Returns the outcome that stops the pull, or `undefined` to go on. */
async function prepareSession(options: NostromoPullOptions): Promise<PullOutcome | undefined> {
  const health = await ensureFreshSession()
  if (health === 'unconfigured') {
    return skipped('unconfigured')
  }
  if (health === 'expired') {
    notifySyncFailure('auth')
    return skipped('auth')
  }

  // An automatic trigger honours the push backoff: the drain is skipped, and the dirty check below
  // then answers conflict-pending, so nothing is dropped. A user action still forces the flush.
  if (!(options.respectBackoff === true && isPushBackoffActive())) {
    await flushNostromoPush()
  }
  if (getNostromoSyncStatus() === 'auth-required') {
    return skipped('auth')
  }
  if (getDirtyUnits().length > 0 || getConflictedUnits().length > 0) {
    return skipped('conflict-pending')
  }
  return undefined
}

async function pullFromServer(config: NostromoConfig, options: NostromoPullOptions): Promise<PullOutcome> {
  const documents = await listAllRemoteDocuments(config)
  const plan = planPull(documents, options.force === true)
  const photoCandidates = planPhotoDownloads(documents)
  const plannedVersions = snapshotBaselineVersions([...plan.toApply, ...photoCandidates].map(({ unit }) => unit))
  const { removedPhotos, keptCollections } = await propagateDeletions(config, documents, plan)
  if (plan.toApply.length === 0 && photoCandidates.length === 0) {
    restoreKeptCollections(keptCollections)
    setNostromoSyncStatus(settledStatus())
    return appliedOrUpToDate(removedPhotos)
  }

  const reads = readAllPayloads(plan.toApply)
  if (typeof reads === 'string') {
    pushNostromoLog('error', `Pull Nostromo annulé, aucune donnée modifiée : ${reads}`)
    setNostromoSyncStatus('error')
    notifySyncFailure('error')
    return { kind: 'error', message: reads }
  }

  // Everything above awaited: a local edit or a baseline move may have landed since the plan.
  // This re-check and the batch of `commitPull` run in the same synchronous turn.
  if (getDirtyUnits().length > 0) {
    setNostromoSyncStatus('pending')
    return skipped('conflict-pending')
  }
  if (hasBaselineMoved(plannedVersions)) {
    pushNostromoLog('warn', 'Pull Nostromo reporté : un document a changé pendant le pull, le prochain pull le relira.')
    setNostromoSyncStatus(settledStatus())
    return skipped('conflict-pending')
  }
  if (plan.toApply.length > 0) {
    await commitPull(plan.toApply, reads)
  }
  const downloadedPhotos = await downloadRemotePhotos(config, photoCandidates)
  // The kept collections are queued only once every re-check has passed: an aborted pull leaves
  // their baselines intact, so the next pull detects the deletion again.
  restoreKeptCollections(keptCollections)
  await settleAfterPull(plan.toApply, downloadedPhotos)
  setNostromoSyncStatus(settledStatus())
  return appliedOrUpToDate([...plan.toApply.map(({ unit }) => unit), ...downloadedPhotos, ...removedPhotos])
}

function appliedOrUpToDate(units: readonly string[]): PullOutcome {
  return units.length > 0 ? { kind: 'applied', units: [...units] } : { kind: 'up-to-date' }
}

/** Units the first listing did not return although a baseline says the server held them. */
interface MissingUnits {
  collections: NostromoUnitName[]
  photos: string[]
}

interface DeletionOutcome {
  /** Collection units confirmed missing and clean: their local data is kept, see `restoreKeptCollections`. */
  keptCollections: NostromoUnitName[]
  /** Photo units removed locally. */
  removedPhotos: string[]
}

/**
 * Applies the deletion rules. A unit is only acted on when a second listing
 * confirms it is gone (one re-list, never a loop). Collections are only reported,
 * never marked: the caller queues them once the pull has passed its re-checks.
 */
async function propagateDeletions(
  config: NostromoConfig,
  documents: readonly NostromoDocument[],
  plan: PullPlan
): Promise<DeletionOutcome> {
  const firstMissing: MissingUnits = { collections: plan.missing, photos: findMissingPhotoUnits(documents) }
  if (firstMissing.collections.length === 0 && firstMissing.photos.length === 0) {
    return { keptCollections: [], removedPhotos: [] }
  }

  const relisted = await listAllRemoteDocuments(config)
  const secondPlan = planPull(relisted, false)
  const secondPhotos = new Set(findMissingPhotoUnits(relisted))
  const confirmed: MissingUnits = {
    collections: firstMissing.collections.filter((unit) => secondPlan.missing.includes(unit)),
    photos: firstMissing.photos.filter((unit) => secondPhotos.has(unit)),
  }

  const keptCollections = confirmedCleanCollections(confirmed.collections)
  const removedPhotos = await removeLocalPhotos(confirmed.photos)
  return { keptCollections, removedPhotos }
}

/** Photo units that have a baseline but whose document is absent from the listing. */
function findMissingPhotoUnits(documents: readonly NostromoDocument[]): string[] {
  const remoteIds = new Set(documents.map((document) => document.id))
  return Object.entries(getAllBaselines())
    .filter(([unit, baseline]) => unit.startsWith(PHOTO_UNIT_PREFIX) && baseline && !remoteIds.has(baseline.docId))
    .map(([unit]) => unit)
}

/** Rule 3 applies to clean collections only: a dirty one is left to the conflict policy. */
function confirmedCleanCollections(units: readonly NostromoUnitName[]): NostromoUnitName[] {
  return units.filter((unit) => !isUnitDirty(unit))
}

/**
 * Rule 3: local data is the only copy left, so it is kept and the next push recreates the document.
 * Runs only after the pull passed its re-checks, so a dirty mark it creates is not mistaken for an edit.
 */
function restoreKeptCollections(units: readonly NostromoUnitName[]): void {
  for (const unit of units) {
    pushNostromoLog(
      'warn',
      `Le document « ${unit} » n'existe plus sur le serveur : les données locales sont conservées.`
    )
    clearBaseline(unit)
    // The local copy is the only one left: queue it so the next push recreates the document.
    markCollectionDirty(unit)
  }
}

/** Rule 2: deletes the local photos whose remote document is gone, never a dirty one. */
async function removeLocalPhotos(units: readonly string[]): Promise<string[]> {
  const removed: string[] = []
  for (const unit of units) {
    if (isUnitDirty(unit)) {
      pushNostromoLog('warn', `La photo « ${unit} » a été modifiée localement : elle est conservée et sera renvoyée.`)
      continue
    }
    const playerId = unit.slice(PHOTO_UNIT_PREFIX.length)
    const revisionBeforeDelete = getDirtyRevision(unit)
    // biome-ignore lint/performance/noAwaitInLoops: one photo at a time, so a failure is attributed to its own unit.
    await deletePhoto(playerId)
    // The photo store marks its own deletion, but it came from the server and must not be pushed back.
    // A change that landed during the delete keeps the unit queued.
    if (!clearUnitDirtyIfUnchanged(unit, revisionBeforeDelete + PHOTO_STORE_MARK_REVISIONS)) {
      pushNostromoLog('warn', `La photo « ${unit} » a été modifiée pendant sa suppression : elle sera renvoyée.`)
    }
    clearBaseline(unit)
    await clearPlayerPhotoFlag(playerId)
    pushNostromoLog('info', `Photo « ${unit} » supprimée localement : le document n'existe plus sur le serveur.`)
    removed.push(unit)
  }
  if (removed.length > 0 && getDirtyUnits().length === 0) {
    cancelDirtyDebounce()
  }
  return removed
}

/** Sets `hasPhoto` to false through the hydrate path, which never marks the players unit dirty. */
async function clearPlayerPhotoFlag(playerId: string): Promise<void> {
  const players = getRawPlayers()
  if (!players.some((player) => player.id === playerId && player.hasPhoto)) {
    return
  }
  hydratePlayers(players.map((player) => (player.id === playerId ? { ...player, hasPhoto: false } : player)))
  await storePlayers(getRawPlayers())
}

/** Decides which collection units need applying, in plan order. */
function planPull(documents: readonly NostromoDocument[], force: boolean): PullPlan {
  const remote = newestCollectionDocuments(documents)
  const plan: PullPlan = { missing: [], toApply: [] }

  for (const unit of NOSTROMO_PLAN_ORDER) {
    const document = remote.get(unit)
    const baseline = getBaseline(unit)
    if (!document) {
      if (baseline) {
        plan.missing.push(unit)
      }
      continue
    }
    if (force || baseline === undefined || document.version > baseline.version) {
      plan.toApply.push({ document, unit })
    }
  }
  return plan
}

/** Keeps, for each collection unit, the remote document with the highest version. */
function newestCollectionDocuments(documents: readonly NostromoDocument[]): Map<NostromoUnitName, NostromoDocument> {
  const newest = new Map<NostromoUnitName, NostromoDocument>()
  for (const document of documents) {
    const payload = toPayloadRecord(document.payload)
    if (payload?.type !== 'collection' || !isCollectionUnitName(payload.name)) {
      continue
    }
    const current = newest.get(payload.name)
    if (!current || document.version > current.version) {
      newest.set(payload.name, document)
    }
  }
  return newest
}

/** Validates every payload. Returns the proven reads, or the reason of the first refusal. */
function readAllPayloads(candidates: readonly PullCandidate[]): ValidCollectionRead[] | string {
  const reads: ValidCollectionRead[] = []
  for (const { document, unit } of candidates) {
    const read = readCollectionPayload(document.payload, unit)
    if (read.kind === 'invalid') {
      return `la charge utile de « ${unit} » est refusée (${read.reason}).`
    }
    reads.push(read)
  }
  return reads
}

/** Swaps every store in one `batch()`, waits for the local persistence, then settles the baselines. */
async function commitPull(candidates: readonly PullCandidate[], reads: readonly ValidCollectionRead[]): Promise<void> {
  const persistence: Promise<void>[] = []
  batch(() => {
    for (const read of reads) {
      persistence.push(applyCollectionPayloadSilently(read))
    }
  })
  await Promise.all(persistence)

  const savedAt = Date.now()
  const updates: NostromoBaselineUpdate[] = candidates.map(({ document, unit }) => ({
    baseline: { docId: document.id, savedAt, version: document.version },
    unit,
  }))
  setBaselines(updates)
  for (const { document, unit } of candidates) {
    pushNostromoLog('info', `Unité « ${unit} » mise à jour depuis le serveur (version ${document.version}).`)
  }
}

/** Photo units whose remote document is newer than their baseline (or has none), with a clean local unit. */
function planPhotoDownloads(documents: readonly NostromoDocument[]): PhotoCandidate[] {
  return documents.flatMap((document): PhotoCandidate[] => {
    const read = readPhotoPayload(document.payload)
    if (read.kind !== 'valid' || !document.file) {
      return []
    }
    const unit = photoUnitName(read.playerId)
    const baseline = getBaseline(unit)
    const upToDate = baseline !== undefined && document.version <= baseline.version
    if (upToDate || isUnitDirty(unit)) {
      return []
    }
    return [{ document, playerId: read.playerId, unit }]
  })
}

function snapshotBaselineVersions(units: readonly string[]): BaselineVersions {
  return new Map(units.map((unit): [string, number | undefined] => [unit, getBaseline(unit)?.version]))
}

function hasBaselineMoved(plannedVersions: BaselineVersions): boolean {
  return [...plannedVersions].some(([unit, version]) => getBaseline(unit)?.version !== version)
}

/** Downloads the planned photos one at a time. A failure is logged and retried by the next pull. */
async function downloadRemotePhotos(config: NostromoConfig, candidates: readonly PhotoCandidate[]): Promise<string[]> {
  if (candidates.length === 0) {
    return []
  }
  // One file token per batch, refetched by the session on a 401/403.
  const session = createFileTokenSession(config)
  const downloaded: string[] = []
  for (const candidate of candidates) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one download at a time, so a failure is attributed to its own unit.
      if (await downloadRemotePhoto(config, session, candidate)) {
        downloaded.push(candidate.unit)
      }
    } catch (error) {
      pushNostromoLog('error', `Photo « ${candidate.unit} » non téléchargée : ${describeError(error)}`)
    }
  }
  return downloaded
}

/** Downloads and stores one photo, unless its local copy became dirty meanwhile. Returns whether it was stored. */
async function downloadRemotePhoto(
  config: NostromoConfig,
  session: FileTokenSession,
  candidate: PhotoCandidate
): Promise<boolean> {
  const { document, playerId, unit } = candidate
  // The document is read again before the download, so the baseline never gets ahead of the blob.
  const fresh = await getDocument(config.baseUrl, config.token, document.id)
  const blob = await downloadPhoto(config, session, { ...fresh, file: fresh.file ?? document.file })
  // No await between this check and the store write: the store marks the unit synchronously.
  if (isUnitDirty(unit)) {
    pushNostromoLog('warn', `La photo « ${unit} » a été modifiée localement : la version du serveur n'est pas reprise.`)
    return false
  }
  const revisionBeforeStore = getDirtyRevision(unit)
  await storePhoto(playerId, blob)
  // The store marked the unit with its own write: that mark is not a local edit and is cleared here.
  if (!clearUnitDirtyIfUnchanged(unit, revisionBeforeStore + PHOTO_STORE_MARK_REVISIONS)) {
    pushNostromoLog('warn', `La photo « ${unit} » a été modifiée pendant son téléchargement : elle sera renvoyée.`)
    return false
  }
  setBaseline(unit, { docId: fresh.id, savedAt: Date.now(), version: fresh.version })
  if (getDirtyUnits().length === 0) {
    cancelDirtyDebounce()
  }
  pushNostromoLog('info', `Photo « ${unit} » téléchargée depuis le serveur (version ${fresh.version}).`)
  return true
}

/**
 * After the commit and the photo downloads: `hasPhoto` follows the photo store, so
 * it is reconciled only now. The contacts of players the server no longer holds
 * are removed when players were applied (the mutation marks the unit dirty).
 */
async function settleAfterPull(applied: readonly PullCandidate[], downloadedPhotos: readonly string[]): Promise<void> {
  const playersApplied = applied.some(({ unit }) => unit === 'players')
  if (!playersApplied && downloadedPhotos.length === 0) {
    return
  }
  await reconcileHasPhoto()
  if (!playersApplied) {
    return
  }
  const removed = removeOrphanContacts(new Set(getRawPlayers().flatMap((player) => (player.id ? [player.id] : []))))
  if (removed > 0) {
    pushNostromoLog('info', `${removed} contact(s) orphelin(s) supprimé(s).`)
  }
}

/** Status left by a pull that did not fail: `pending` while the outbox is not empty. */
function settledStatus(): NostromoStatus {
  return getDirtyUnits().length > 0 ? 'pending' : 'saved'
}

function skipped(reason: NostromoPullSkipReason): PullOutcome {
  return { kind: 'skipped', reason }
}

/** Maps a failure to an outcome: auth and network are quiet skips, anything else is an error. */
function failPull(error: unknown): PullOutcome {
  if (error instanceof NostromoClientError && error.kind === 'auth') {
    setNostromoSyncStatus('auth-required')
    notifySyncFailure('auth')
    return skipped('auth')
  }
  if (error instanceof NostromoClientError && error.kind === 'network') {
    setNostromoSyncStatus(settledStatus())
    return skipped('offline')
  }
  const message = describeError(error)
  pushNostromoLog('error', `Le pull Nostromo a échoué : ${message}`)
  setNostromoSyncStatus('error')
  notifySyncFailure('error')
  return { kind: 'error', message }
}
