/**
 * Push half of the Nostromo synchronization: send the local changes, one
 * document per unit.
 *
 * Shape of a run (`flushNostromoPush`):
 *
 * - collections first, in a fixed order (clubs → players → teams → matchs →
 *   contacts → trombiTitles), then photos: a reader always sees a player's team
 *   and club before the player itself, and never a photo whose player is missing,
 * - one document per unit, created on the first push and updated afterwards with
 *   the mandatory `expectedVersion` (the server answers 409 on a stale one),
 * - a unit that fails stays in the outbox and is retried by the next run; a
 *   conflict parks it, in its baseline, until the conflict is explicitly resolved,
 * - a unit whose document already exists is never overwritten with an empty local
 *   default: the version is adopted, the local data is left alone, and the user
 *   pulls the server content through the restore (see `pushCollectionUnit`),
 * - the remote document of a photo the device no longer holds is deleted too, so
 *   a later restore cannot bring back a deleted photo,
 * - a unit that changes while its own push is in flight stays queued: the run
 *   only clears the mark it pushed (see `clearUnitDirtyIfUnchanged`).
 *
 * The engine only ever READS the collections, through the clone getters of their
 * stores (`./units`): it never hydrates, never persists and never subscribes.
 */
import { getPhoto, PHOTO_FILE_EXTENSION } from '../photo-store/photo-store'
import {
  createDocument,
  deleteDocument,
  getDocument,
  NostromoClientError,
  photoDocId,
  updateDocument,
  uploadDocumentFile,
} from './client'
import type { NostromoDocument } from './client.d'
import { armDirtyDebounce, cancelDirtyDebounce, PHOTO_UNIT_PREFIX, setDirtyFlushRunner } from './dirty-marks'
import { getConfig, isConfigured } from './nostromo-config-store'
import type { NostromoConfig } from './nostromo-config-store.d'
import {
  clearBaseline,
  clearUnitDirty,
  clearUnitDirtyIfUnchanged,
  getBaseline,
  getConflictedUnits,
  getDirtyRevision,
  getDirtyUnits,
  pushNostromoLog,
  setBaseline,
  setNostromoSyncStatus,
} from './nostromo-sync-store'
import type { NostromoBaseline, NostromoStatus, NostromoUnitName } from './nostromo-sync-store.d'
import { buildPhotoPayload, describeError } from './payload'
import type { NostromoCollectionPayload, NostromoPhotoPayload, NostromoPushOutcome } from './push-engine.d'
import {
  buildUnitPayload,
  collectionDocId,
  countCollectionItems,
  isCollectionUnitName,
  NOSTROMO_PUSH_ORDER,
} from './units'

/** Client-side ceiling for a photo upload: a bigger document file is refused before the round trip. */
export const NOSTROMO_MAX_PHOTO_BYTES = 20 * 1024 * 1024

/** Retry cadence of the auto-sync interval: a failed unit gets another chance every minute. */
export const NOSTROMO_RETRY_INTERVAL_MS = 60_000

/**
 * The payload contract and the unit model live in their own modules (`./payload`
 * and `./units`), shared with the restore; the dirty markers live in a leaf
 * module (the stores import them, and the engine imports the stores: keeping the
 * marks here would close a cycle at module evaluation time). They are re-exported
 * here so the sync layer keeps one public entry point next to the flush (the
 * modules themselves stay direct-importable).
 */
// biome-ignore lint/performance/noBarrelFile: the sync layer's documented public entry point, not a barrel.
export { DIRTY_DEBOUNCE_MS, markCollectionDirty, markPhotoDirty, photoUnitName } from './dirty-marks'
export { getConflictedUnits } from './nostromo-sync-store'
export { NOSTROMO_PAYLOAD_SCHEMA } from './payload'
export { collectionDocId } from './units'

/**
 * Pushes every dirty unit, in a fixed order. Never throws: each failure is
 * logged and mapped to a status, and the units that failed stay in the outbox.
 * Concurrent calls share one run: a debounce flush and a visibility flush never
 * push the same unit twice in parallel.
 */
export function flushNostromoPush(): Promise<void> {
  if (flushInFlight) {
    return flushInFlight
  }
  const run = runFlush().finally(() => {
    flushInFlight = undefined
  })
  flushInFlight = run
  return run
}

let flushInFlight: Promise<void> | undefined

async function runFlush(): Promise<void> {
  try {
    await pushDirtyUnits()
  } catch (error) {
    pushNostromoLog('error', `La synchronisation Nostromo a échoué de façon inattendue : ${describeError(error)}`)
    setNostromoSyncStatus('error')
  }
}

async function pushDirtyUnits(): Promise<void> {
  const conflicted = new Set(getConflictedUnits())
  const units = selectPushableUnits(conflicted)
  if (units.length === 0) {
    return
  }

  const config = getConfig()
  if (!(config && isConfigured())) {
    setNostromoSyncStatus('off')
    pushNostromoLog('info', "Nostromo n'est pas configuré : les changements en attente restent dans la file.")
    return
  }

  cancelDirtyDebounce()
  setNostromoSyncStatus('saving')

  let hadError = false
  for (const unit of units) {
    // The revision is read BEFORE the first call of the unit: a mark landing
    // during the push moves it, which means the content being sent is stale.
    const revision = getDirtyRevision(unit)
    // biome-ignore lint/performance/noAwaitInLoops: the push order is a contract and a 401 must abort the remaining units.
    const outcome = await pushUnit(config, unit, revision)
    if (outcome === 'auth') {
      setNostromoSyncStatus('auth-required')
      return
    }
    if (outcome === 'conflict') {
      parkConflictedUnit(unit)
      conflicted.add(unit)
    }
    if (outcome === 'error') {
      hadError = true
    }
  }

  setNostromoSyncStatus(finalStatus(hadError, conflicted))
}

/**
 * Dirty units this run may push, in push order. Conflicted units are skipped
 * (they wait for an explicit resolution) and a unit this version no longer
 * knows is dropped: it could never be pushed, so retrying it forever would only
 * keep the outbox non-empty.
 */
function selectPushableUnits(conflicted: ReadonlySet<string>): string[] {
  const collections: NostromoUnitName[] = []
  const photos: string[] = []

  for (const unit of getDirtyUnits()) {
    if (conflicted.has(unit)) {
      continue
    }
    if (unit.startsWith(PHOTO_UNIT_PREFIX)) {
      photos.push(unit)
      continue
    }
    if (isCollectionUnitName(unit)) {
      collections.push(unit)
      continue
    }
    clearUnitDirty(unit)
    pushNostromoLog('warn', `Élément inconnu « ${unit} » retiré de la file d'attente.`)
  }

  return [...NOSTROMO_PUSH_ORDER.filter((unit) => collections.includes(unit)), ...photos]
}

/** Status left by a completed run: the worst thing that happened wins. */
function finalStatus(hadError: boolean, conflicted: ReadonlySet<string>): NostromoStatus {
  const remaining = getDirtyUnits()
  if (remaining.some((unit) => conflicted.has(unit))) {
    return 'conflict'
  }
  if (hadError) {
    return 'error'
  }
  return remaining.length > 0 ? 'pending' : 'saved'
}

async function pushUnit(config: NostromoConfig, unit: string, revision: number): Promise<NostromoPushOutcome> {
  try {
    if (unit.startsWith(PHOTO_UNIT_PREFIX)) {
      return await pushPhotoUnit(config, unit, revision)
    }
    // `selectPushableUnits` only ever returns collection names and photo units.
    return await pushCollectionUnit(config, unit as NostromoUnitName, revision)
  } catch (error) {
    return reportUnitFailure(unit, error)
  }
}

/** Logs one failed unit and tells the run how to react to it. */
function reportUnitFailure(unit: string, error: unknown): NostromoPushOutcome {
  if (!(error instanceof NostromoClientError)) {
    pushNostromoLog('warn', `L'envoi de ${unit} a échoué de façon inattendue : ${describeError(error)}`)
    return 'error'
  }
  switch (error.kind) {
    case 'auth':
      pushNostromoLog('warn', `L'envoi de ${unit} a été refusé (401) : la session doit être renouvelée.`)
      return 'auth'
    case 'conflict':
      pushNostromoLog(
        'error',
        `Conflit sur ${unit} : la copie du serveur a dépassé la dernière référence locale. Les changements locaux sont conservés ; l'élément reste en attente jusqu'à la résolution du conflit.`
      )
      return 'conflict'
    default:
      pushNostromoLog('warn', `L'envoi de ${unit} a échoué : ${error.message}`)
      return 'error'
  }
}

async function pushCollectionUnit(
  config: NostromoConfig,
  unit: NostromoUnitName,
  revision: number
): Promise<NostromoPushOutcome> {
  const docId = collectionDocId(unit)
  const payload = buildUnitPayload(unit)
  const start = await startDocument(config, unit, docId, payload)

  if (!start.adopted) {
    return commitUnitBaseline(unit, docId, start.version, revision)
  }

  // The id was taken (another machine, or a lost baseline). A local unit holding
  // nothing has nothing to send: the server document is adopted alone, so a
  // fresh device cannot overwrite content it has not pulled yet with its empty
  // default. The user pulls that content through the restore when they want it.
  if (countCollectionItems(unit) === 0) {
    pushNostromoLog(
      'info',
      `Document existant de ${unit} adopté (version ${start.version}) sans envoyer de données locales vides.`
    )
    return commitUnitBaseline(unit, docId, start.version, revision, 'adopted')
  }

  // With local content, the adopted version is the one the update must expect:
  // the unit converges in this run.
  pushNostromoLog('warn', `Document existant de ${unit} adopté (version ${start.version}).`)
  const updated = await updateDocument(config.baseUrl, config.token, docId, {
    expectedVersion: start.version,
    payload,
  })
  return commitUnitBaseline(unit, docId, updated.version, revision)
}

async function pushPhotoUnit(config: NostromoConfig, unit: string, revision: number): Promise<NostromoPushOutcome> {
  const playerId = unit.slice(PHOTO_UNIT_PREFIX.length)
  const blob = await getPhoto(playerId)
  if (!blob) {
    return await pushDeletedPhoto(config, unit, playerId, revision)
  }
  if (blob.size > NOSTROMO_MAX_PHOTO_BYTES) {
    pushNostromoLog(
      'error',
      `La photo du joueur ${playerId} pèse ${blob.size} octets, au-dessus de la limite de ${NOSTROMO_MAX_PHOTO_BYTES} octets : elle reste en attente.`
    )
    return 'error'
  }

  const docId = photoDocId(playerId)
  const payload = buildPhotoPayload(playerId)
  const start = await startDocument(config, unit, docId, payload)

  if (start.adopted) {
    pushNostromoLog('warn', `Document existant de ${unit} adopté (version ${start.version}).`)
  }

  // The upload bumps the version again: the returned value is the one to keep.
  const uploaded = await uploadDocumentFile(config.baseUrl, config.token, docId, {
    expectedVersion: start.version,
    file: blob,
    filename: `${playerId}${PHOTO_FILE_EXTENSION}`,
  })
  return commitUnitBaseline(unit, docId, uploaded.version, revision)
}

/**
 * The local copy of a photo is gone while the server may still hold one: the
 * remote document goes with the local copy, so a restore cannot bring back a
 * photo the device deleted. A document the server no longer holds (404) is
 * already gone, which is the same outcome. Without a baseline nothing is known
 * about the server: the unit is simply cleared.
 */
async function pushDeletedPhoto(
  config: NostromoConfig,
  unit: string,
  playerId: string,
  revision: number
): Promise<NostromoPushOutcome> {
  const baseline = getBaseline(unit)
  if (!baseline) {
    clearUnitDirtyIfUnchanged(unit, revision)
    pushNostromoLog('warn', `La photo du joueur ${playerId} n'est pas stockée localement : rien à envoyer.`)
    return 'ok'
  }

  await deleteRemoteDocument(config, baseline.docId)
  clearBaseline(unit)
  if (!clearUnitDirtyIfUnchanged(unit, revision)) {
    armDirtyDebounce()
    pushNostromoLog('warn', `${unit} a changé pendant son envoi : il reste en attente d'un nouvel envoi.`)
  }
  pushNostromoLog('info', `Photo distante du joueur ${playerId} supprimée (document ${baseline.docId}).`)
  return 'ok'
}

/** Deletes a remote document, tolerating one the server no longer holds. */
async function deleteRemoteDocument(config: NostromoConfig, docId: string): Promise<void> {
  try {
    await deleteDocument(config.baseUrl, config.token, docId)
  } catch (error) {
    if (error instanceof NostromoClientError && error.kind === 'notfound') {
      return
    }
    throw error
  }
}

/** What a push learned about the document of a unit before writing it. */
interface DocumentStart {
  /** True when the document already existed and only its version was adopted. */
  adopted: boolean
  /** Version the caller must send as `expectedVersion` for its next write. */
  version: number
}

/**
 * Brings the unit document to a known version: the baselined one is reused, an
 * unknown one is created (or adopted when a create is refused because the id is
 * already taken).
 */
async function startDocument(
  config: NostromoConfig,
  unit: string,
  docId: string,
  payload: NostromoCollectionPayload | NostromoPhotoPayload
): Promise<DocumentStart> {
  const baseline = getBaseline(unit)
  if (!baseline) {
    return await createOrAdoptDocument(config, docId, payload)
  }
  const updated = await updateDocument(config.baseUrl, config.token, docId, {
    expectedVersion: baseline.version,
    payload,
  })
  return { adopted: false, version: updated.version }
}

/**
 * Creates the unit document, or learns the version of the one already stored
 * under that id.
 *
 * A 400 on a create is ambiguous by contract: the id may be taken (it always is
 * when two machines derive it from the same name) or the create rule refused the
 * body. Re-reading the id tells the two apart: a readable document is adopted (its
 * version only is learned here, the caller decides what to write with it), a 404
 * rethrows the original refusal so the run reports a real error.
 */
async function createOrAdoptDocument(
  config: NostromoConfig,
  docId: string,
  payload: NostromoCollectionPayload | NostromoPhotoPayload
): Promise<DocumentStart> {
  try {
    const created = await createDocument(config.baseUrl, config.token, { id: docId, owner: config.userId, payload })
    return { adopted: false, version: created.version }
  } catch (error) {
    if (!isIdRefusal(error)) {
      throw error
    }
    const existing = await readAdoptedDocument(config, docId, error)
    return { adopted: true, version: existing.version }
  }
}

function isIdRefusal(error: unknown): boolean {
  return error instanceof NostromoClientError && error.kind === 'validation' && error.status === 400
}

async function readAdoptedDocument(config: NostromoConfig, docId: string, refusal: unknown): Promise<NostromoDocument> {
  try {
    return await getDocument(config.baseUrl, config.token, docId)
  } catch (error) {
    if (error instanceof NostromoClientError && error.kind === 'notfound') {
      throw refusal
    }
    throw error
  }
}

/**
 * Learns the version a successful write produced, and closes the unit.
 *
 * The unit leaves the outbox only when no further local change was marked while
 * the push was in flight: a mark means the content that was just sent is already
 * stale, so the unit stays queued and a follow-up push is armed instead of being
 * reported as saved. `action` is what put the unit at that version, so the closing
 * line never claims a push that did not happen (a unit adopted while empty).
 */
function commitUnitBaseline(
  unit: string,
  docId: string,
  version: number,
  revision: number,
  action: 'adopted' | 'pushed' = 'pushed'
): NostromoPushOutcome {
  setBaseline(unit, { docId, savedAt: Date.now(), version })
  if (!clearUnitDirtyIfUnchanged(unit, revision)) {
    armDirtyDebounce()
    pushNostromoLog('warn', `${unit} a changé pendant son envoi : il reste en attente d'un nouvel envoi.`)
    return 'ok'
  }
  pushNostromoLog('info', `${action === 'pushed' ? 'Envoi de' : 'Adoption de'} ${unit} (version ${version}).`)
  return 'ok'
}

/**
 * Conflict API of the engine. `getConflictedUnits` is read from the store (the
 * `conflicted` flag of each baseline, so the parking survives a reload) and
 * re-exported here: parking is sticky on purpose, a unit the engine must not
 * overwrite again until `resolveNostromoConflict` (or a full reset) is called by
 * the conflict UI.
 */

/** Unparks a unit: the next flush pushes it again (used after restore/overwrite). */
export function resolveNostromoConflict(unit: string): void {
  setUnitConflicted(unit, false)
}

/** Unparks every unit (sign-out, or a global "overwrite the server" decision). */
export function clearAllNostromoConflicts(): void {
  for (const unit of getConflictedUnits()) {
    setUnitConflicted(unit, false)
  }
}

/** Parks a unit whose push hit a 409, so the next run leaves the server copy alone. */
function parkConflictedUnit(unit: string): void {
  setUnitConflicted(unit, true)
}

/**
 * Writes the parking flag on the baseline of a unit, which is the only piece of
 * sync state that survives a reload. A unit with no baseline cannot carry the
 * flag: nothing describes the server state it conflicts with, so the next run
 * simply retries it.
 */
function setUnitConflicted(unit: string, conflicted: boolean): void {
  const baseline = getBaseline(unit)
  if (!(baseline && baseline.conflicted !== conflicted)) {
    return
  }
  const next: NostromoBaseline = { docId: baseline.docId, savedAt: baseline.savedAt, version: baseline.version }
  if (conflicted) {
    next.conflicted = true
  }
  setBaseline(unit, next)
}

/**
 * The debounce timer of the dirty marks calls this engine's flush: the runner is
 * registered at module load so a mark made before any auto-sync wiring still
 * pushes when its window expires.
 */
setDirtyFlushRunner(launchFlush)

/**
 * Fire-and-forget launch. A flush reports through the status and the log, so a
 * rejection could only come from a bug: it is logged as one, never swallowed.
 */
function launchFlush(): void {
  flushNostromoPush().catch((error: unknown) => {
    console.error('flushNostromoPush failed:', error)
  })
}

let retryTimer: ReturnType<typeof setInterval> | undefined

/** Pushes only when there is something to push and a backend to push it to. */
function flushWhenPending(): void {
  if (getDirtyUnits().length === 0 || !isConfigured()) {
    return
  }
  launchFlush()
}

function onVisibilityHidden(): void {
  if (document.visibilityState !== 'hidden') {
    return
  }
  flushWhenPending()
}

/**
 * Installs the two retries the engine runs on its own: one every
 * `NOSTROMO_RETRY_INTERVAL_MS`, and one when the tab becomes hidden (the last
 * moment the browser gives us before it freezes the page). Idempotent: calling
 * it twice installs nothing twice.
 */
export function startNostromoAutoSync(): void {
  if (retryTimer !== undefined) {
    return
  }
  retryTimer = setInterval(flushWhenPending, NOSTROMO_RETRY_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibilityHidden)
}

/** Removes the interval and the visibility listener (sign-out, tests). Safe when not started. */
export function stopNostromoAutoSync(): void {
  if (retryTimer !== undefined) {
    clearInterval(retryTimer)
    retryTimer = undefined
  }
  document.removeEventListener('visibilitychange', onVisibilityHidden)
}
