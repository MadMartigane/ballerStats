/**
 * Remote snapshot: the safety net taken before a destructive flow propagates.
 *
 * Before a wipe, an import or a demo dataset replacement overrides the server
 * state, the current remote state is captured into IndexedDB: the collection
 * documents and the photo documents with their image files. Only ONE snapshot is
 * kept (the latest capture overwrites the previous one): this is a net that
 * catches a human or environment mistake, not an archive.
 *
 * `restoreRemoteSnapshot()` writes the snapshot back to the server (create or
 * update, with the version the live server currently holds), then applies it to
 * the local stores and settles the baselines, so both sides return to the
 * captured state.
 *
 * A failed capture must never block the destructive flow: the caller awaits
 * `captureRemoteSnapshot()` and swallows its rejection (`console.error`), because
 * an unreachable network is not a reason to stop the user.
 */
import { createStore, get, set } from 'idb-keyval'
import { batch } from 'solid-js'

import { PHOTO_FILE_EXTENSION, setPhotoAndFlag, storePhoto } from '../photo-store/photo-store'
import Player from '../player/player'
import { getPlayerById, updatePlayer } from '../stores/players-store'
import { downloadFile, getFileToken, NostromoClientError, updateDocument, uploadDocumentFile } from './client'
import type { NostromoDocument } from './client.d'
import { cancelDirtyDebounce, photoUnitName } from './dirty-marks'
import { createOrAdoptDocument } from './document-write'
import { listAllRemoteDocuments } from './listing'
import { getConfig, isConfigured } from './nostromo-config-store'
import type { NostromoConfig } from './nostromo-config-store.d'
import {
  getDirtyUnits,
  pushNostromoLog,
  setBaselines,
  setDirtyUnits,
  setNostromoSyncStatus,
} from './nostromo-sync-store'
import type { NostromoBaselineUpdate, NostromoUnitName } from './nostromo-sync-store.d'
import { describeError, readCollectionPayload, readPhotoPayload, toPayloadRecord } from './payload'
import type {
  RemoteSnapshot,
  RemoteSnapshotCollectionDocument,
  RemoteSnapshotDescription,
  RemoteSnapshotPhotoDocument,
  RemoteSnapshotRestoreResult,
} from './remote-snapshot.d'
import { applyCollectionPayload, isCollectionUnitName } from './units'

/** Dedicated IndexedDB database and store of the safety net. */
const snapshotStore = createStore('nostromo-snapshots-db', 'snapshots')

/** Single key: only the latest snapshot is kept. */
const SNAPSHOT_KEY = 'latest'

/**
 * Captures the current remote state under `reason`. No-op when Nostromo is
 * unconfigured (no client call is made). A photo whose download fails is skipped
 * with a warning: the snapshot still holds the rest, which beats no snapshot at
 * all. Storage write failures propagate, so the caller can report them.
 *
 * Returns the listing the capture read, so a caller that also needs the remote
 * documents (the import orphan cleanup) reuses the same pass instead of listing
 * a second time. `undefined` when nothing was listed (unconfigured Nostromo).
 */
export async function captureRemoteSnapshot(reason: string): Promise<NostromoDocument[] | undefined> {
  if (!isConfigured()) {
    return undefined
  }
  const config = getConfig()
  if (!config) {
    return undefined
  }

  const documents = await listAllRemoteDocuments(config)
  const snapshot: RemoteSnapshot = {
    collections: collectCollections(documents),
    createdAt: Date.now(),
    id: createSnapshotId(),
    photos: await collectPhotos(config, documents),
    reason,
  }

  await set(SNAPSHOT_KEY, snapshot, snapshotStore)
  pushNostromoLog(
    'info',
    `Instantané Nostromo : état distant capturé avant « ${reason} » (${snapshot.collections.length} collections, ${snapshot.photos.length} photos).`
  )
  return documents
}

/** Reads the stored snapshot, or `undefined` when none was ever captured. */
async function readStoredSnapshot(): Promise<RemoteSnapshot | undefined> {
  return await get<RemoteSnapshot>(SNAPSHOT_KEY, snapshotStore)
}

/** True when a snapshot is available for a restore. */
export async function hasRemoteSnapshot(): Promise<boolean> {
  return (await readStoredSnapshot()) !== undefined
}

/** What the card displays about the stored snapshot, without its payload. */
export async function describeRemoteSnapshot(): Promise<RemoteSnapshotDescription | undefined> {
  const snapshot = await readStoredSnapshot()
  if (!snapshot) {
    return undefined
  }
  return {
    collectionCount: snapshot.collections.length,
    createdAt: snapshot.createdAt,
    id: snapshot.id,
    photoCount: snapshot.photos.length,
    reason: snapshot.reason,
  }
}

/** The collection documents of a listing, in listing order. */
function collectCollections(documents: NostromoDocument[]): RemoteSnapshotCollectionDocument[] {
  const collections: RemoteSnapshotCollectionDocument[] = []
  for (const document of documents) {
    const record = toPayloadRecord(document.payload)
    if (record?.type === 'collection' && isCollectionUnitName(record.name)) {
      collections.push({ docId: document.id, payload: document.payload, version: document.version })
    }
  }
  return collections
}

/** The photo documents of a listing, with their file downloaded. */
async function collectPhotos(
  config: NostromoConfig,
  documents: NostromoDocument[]
): Promise<RemoteSnapshotPhotoDocument[]> {
  const photos: RemoteSnapshotPhotoDocument[] = []
  for (const document of documents) {
    const record = toPayloadRecord(document.payload)
    if (record?.type !== 'photo' || !document.file) {
      continue
    }
    const read = readPhotoPayload(document.payload)
    if (read.kind === 'invalid') {
      continue
    }
    try {
      // A file token lives about 180 seconds: mint a fresh one per download.
      // biome-ignore lint/performance/noAwaitInLoops: one photo at a time keeps memory bounded, and each download needs its own file token.
      const fileToken = await getFileToken(config.baseUrl, config.token)
      const blob = await downloadFile(config.baseUrl, fileToken, document.id, document.file)
      photos.push({
        blob,
        docId: document.id,
        payload: document.payload,
        playerId: read.playerId,
        version: document.version,
      })
    } catch (error) {
      pushNostromoLog(
        'warn',
        `Instantané Nostromo : la photo du joueur ${read.playerId} n'a pas pu être capturée : ${describeError(error)}`
      )
    }
  }
  return photos
}

/**
 * Writes the snapshot back to the server, then applies it locally and settles the
 * baselines. Throws when Nostromo is unconfigured or no snapshot exists; a
 * refused session (401) aborts the run after settling what was already written.
 * Every other per-unit failure is reported in `failedUnits` and the others are
 * still restored.
 */
export async function restoreRemoteSnapshot(): Promise<RemoteSnapshotRestoreResult> {
  const config = getConfig()
  if (!config) {
    throw new NostromoClientError("Nostromo n'est pas configuré : connectez-vous avant de restaurer.", { kind: 'auth' })
  }
  const snapshot = await readStoredSnapshot()
  if (!snapshot) {
    throw new Error("Aucun instantané serveur n'est disponible.")
  }

  setNostromoSyncStatus('saving')
  cancelDirtyDebounce()
  pushNostromoLog('info', `Instantané Nostromo : restauration de l'instantané « ${snapshot.reason} ».`)

  const state = createApplyState()
  try {
    await encodeSnapshotIntoState(config, snapshot, state)
  } catch (error) {
    settleSnapshotRestore(state)
    // An aborted run is never a save; a refused session keeps its own status.
    setNostromoSyncStatus(isAuthError(error) ? 'auth-required' : 'error')
    throw error
  }

  await applySnapshotLocally(state)
  settleSnapshotRestore(state)
  pushNostromoLog(
    'info',
    `Instantané Nostromo : ${state.baselines.length} éléments restaurés, ${state.failedUnits.length} en échec.`
  )
  return {
    collections: state.localCollections.length,
    failedUnits: [...state.failedUnits],
    photos: state.localPhotos.length,
  }
}

/** Accumulator of one snapshot restore, shared by its phases. */
interface SnapshotApplyState {
  baselines: NostromoBaselineUpdate[]
  failedUnits: string[]
  localCollections: { payload: unknown; unit: NostromoUnitName }[]
  localPhotos: { blob: Blob; playerId: string }[]
}

function createApplyState(): SnapshotApplyState {
  return { baselines: [], failedUnits: [], localCollections: [], localPhotos: [] }
}

/** Upserts every snapshot document to the server and remembers what to apply locally. */
async function encodeSnapshotIntoState(
  config: NostromoConfig,
  snapshot: RemoteSnapshot,
  state: SnapshotApplyState
): Promise<void> {
  const current = new Map((await listAllRemoteDocuments(config)).map((document) => [document.id, document]))

  for (const document of snapshot.collections) {
    const record = toPayloadRecord(document.payload)
    const unit = record?.type === 'collection' && isCollectionUnitName(record.name) ? record.name : undefined
    if (!unit) {
      state.failedUnits.push(`collection:${document.docId}`)
      continue
    }
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one document per unit, in snapshot order.
      const version = await upsertDocument(config, current, document.docId, document.payload)
      state.baselines.push({ baseline: { docId: document.docId, savedAt: 0, version }, unit })
      state.localCollections.push({ payload: document.payload, unit })
    } catch (error) {
      rethrowIfAuth(error)
      reportUnitFailure(state, unit, error)
    }
  }

  for (const document of snapshot.photos) {
    const unit = photoUnitName(document.playerId)
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one photo at a time keeps memory bounded.
      const version = await upsertDocument(config, current, document.docId, document.payload)
      // The file upload bumps the version again: the returned value is the one to keep.
      const uploaded = await uploadDocumentFile(config.baseUrl, config.token, document.docId, {
        expectedVersion: version,
        file: document.blob,
        filename: `${document.playerId}${PHOTO_FILE_EXTENSION}`,
      })
      state.baselines.push({ baseline: { docId: document.docId, savedAt: 0, version: uploaded.version }, unit })
      state.localPhotos.push({ blob: document.blob, playerId: document.playerId })
    } catch (error) {
      rethrowIfAuth(error)
      reportUnitFailure(state, unit, error)
    }
  }
}

/**
 * Brings the document to the snapshot payload: updates the live one with the
 * version it already holds, or writes it through the shared create-or-adopt
 * path. A create refused because the id is taken (400) is adopted by re-reading
 * it, exactly like the push engine, then the snapshot payload is written onto
 * the adopted version: the restore converges even when the server holds the id
 * under a document the listing did not show.
 */
async function upsertDocument(
  config: NostromoConfig,
  current: ReadonlyMap<string, NostromoDocument>,
  docId: string,
  payload: unknown
): Promise<number> {
  const existing = current.get(docId)
  if (existing) {
    const updated = await updateDocument(config.baseUrl, config.token, docId, {
      expectedVersion: existing.version,
      payload,
    })
    return updated.version
  }

  const start = await createOrAdoptDocument(config, docId, payload)
  if (!start.adopted) {
    return start.version
  }
  const adopted = await updateDocument(config.baseUrl, config.token, docId, {
    expectedVersion: start.version,
    payload,
  })
  return adopted.version
}

/** Applies the successfully written units to the local stores. */
async function applySnapshotLocally(state: SnapshotApplyState): Promise<void> {
  const persists: Promise<void>[] = []
  batch(() => {
    for (const entry of state.localCollections) {
      try {
        const read = readCollectionPayload(entry.payload, entry.unit)
        if (read.kind === 'invalid') {
          state.failedUnits.push(entry.unit)
          continue
        }
        const persist = applyCollectionPayload(read)
        if (persist) {
          persists.push(persist)
        }
      } catch (error) {
        reportUnitFailure(state, entry.unit, error)
      }
    }
  })
  await settleAsyncPersists(persists)

  for (const photo of state.localPhotos) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one photo at a time keeps memory bounded.
      await storeRestoredPhoto(photo.playerId, photo.blob)
    } catch (error) {
      reportUnitFailure(state, photoUnitName(photo.playerId), error)
    }
  }
}

/**
 * Stores a restored photo and keeps the `hasPhoto` flag of its player in sync,
 * exactly like the pull path does. The flag helpers take a `Player`, so the
 * player is read, flagged, then written back through the canonical edit funnel.
 */
async function storeRestoredPhoto(playerId: string, blob: Blob): Promise<void> {
  const raw = getPlayerById(playerId)
  if (!raw) {
    await storePhoto(playerId, blob)
    return
  }
  const player = new Player(raw)
  await setPhotoAndFlag(player, blob)
  updatePlayer(playerId, player.getRawData())
}

/** Settles the run: baselines once, outbox drop, status. Runs after the last local write. */
function settleSnapshotRestore(state: SnapshotApplyState): void {
  cancelDirtyDebounce()
  const savedAt = Date.now()
  setBaselines(state.baselines.map(({ baseline, unit }) => ({ baseline: { ...baseline, savedAt }, unit })))
  dropFromOutbox(new Set(state.baselines.map(({ unit }) => unit)))
  setNostromoSyncStatus(state.failedUnits.length > 0 ? 'error' : 'saved')
}

/** Removes the restored units from the outbox, in a single write. */
function dropFromOutbox(restored: ReadonlySet<string>): void {
  const current = getDirtyUnits()
  const remaining = current.filter((unit) => !restored.has(unit))
  if (remaining.length !== current.length) {
    setDirtyUnits(remaining)
  }
}

/** Logs one failed unit and keeps the run going. */
function reportUnitFailure(state: SnapshotApplyState, unit: string, error: unknown): void {
  state.failedUnits.push(unit)
  pushNostromoLog('error', `Instantané Nostromo : la restauration de ${unit} a échoué : ${describeError(error)}`)
}

/** True when the failure is a refused session, the only failure that aborts the run. */
function isAuthError(error: unknown): boolean {
  return error instanceof NostromoClientError && error.kind === 'auth'
}

/** A refused session aborts the run; every other failure is a per-unit failure. */
function rethrowIfAuth(error: unknown): void {
  if (isAuthError(error)) {
    setNostromoSyncStatus('auth-required')
    throw error
  }
}

/** Awaits the storage writes the unit stores returned, without failing the run on one. */
async function settleAsyncPersists(persists: Promise<void>[]): Promise<void> {
  for (const persist of persists) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: the writes are awaited one by one so one failure never cancels the others.
      await persist
    } catch (error) {
      pushNostromoLog(
        'error',
        `Instantané Nostromo : l'enregistrement d'une collection restaurée a échoué : ${describeError(error)}`
      )
    }
  }
}

/** Internal id of a snapshot: never sent anywhere, only used to identify a record. */
function createSnapshotId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
