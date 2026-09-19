import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllPhotos, getPhoto, storePhoto } from '../photo-store/photo-store'
import { hydrateClubs } from '../stores/clubs-store'
import { hydrateContacts } from '../stores/contacts-store'
import { hydrateMatchs } from '../stores/matchs-store'
import { hydratePlayers } from '../stores/players-store'
import { hydrateTeams } from '../stores/teams-store'
import { getTitles } from '../trombi-titles-store'
import {
  createDocument,
  deleteDocument,
  getDocument,
  NostromoClientError,
  photoDocId,
  updateDocument,
  uploadDocumentFile,
} from './client'
import type { NostromoCreateDocumentInput, NostromoDocument, NostromoErrorKind } from './client.d'
import { DIRTY_DEBOUNCE_MS, markCollectionDirty, markPhotoDirty, photoUnitName } from './dirty-marks'
import { hydrateNostromoConfig } from './nostromo-config-store'
import type { NostromoConfig } from './nostromo-config-store.d'
import {
  getBaseline,
  getDirtyUnits,
  getNostromoLog,
  getNostromoSyncStatus,
  hydrateNostromoSync,
  markUnitDirty,
  STORAGE_NOSTROMO_BASELINES_KEY,
  setBaseline,
  setDirtyUnits,
} from './nostromo-sync-store'
import type { NostromoBaselines, NostromoUnitName } from './nostromo-sync-store.d'
import {
  clearAllNostromoConflicts,
  collectionDocId,
  flushNostromoPush,
  getConflictedUnits,
  NOSTROMO_MAX_PHOTO_BYTES,
  NOSTROMO_RETRY_INTERVAL_MS,
  markCollectionDirty as reExportedMarkCollectionDirty,
  resolveNostromoConflict,
  startNostromoAutoSync,
  stopNostromoAutoSync,
} from './push-engine'

/**
 * Tests of the push engine. The Nostromo client is mocked call by call (the
 * fetch layer has its own suite in `client.test.ts`), the stores and the sync
 * store are the real ones, and the photo blobs go through the real photo store
 * backed by `fake-indexeddb` (installed by `vitest.setup.ts`).
 */
vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return {
    ...actual,
    createDocument: vi.fn(),
    deleteDocument: vi.fn(),
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
    uploadDocumentFile: vi.fn(),
  }
})

/**
 * The writes of the photo store are real (they queue the unit), but the bytes
 * are served from the test: `fake-indexeddb` runs the store through a structured
 * clone that does not give back a genuine `Blob`, so the size guard could not be
 * exercised. The clone itself is covered by `photo-store.test.ts`.
 */
vi.mock('../photo-store/photo-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../photo-store/photo-store')>()
  return {
    ...actual,
    getPhoto: vi.fn(),
  }
})

const BASE_URL = 'https://nostromo.example.com'
const TOKEN = 'auth-token-raw-value'
const USER_ID = 'user-owner-001'
const DOCUMENT_ID_PATTERN = /^[a-z0-9]{15}$/
const COLLECTIONS: NostromoUnitName[] = ['clubs', 'players', 'teams', 'matchs', 'contacts', 'trombiTitles']

const createDocumentMock = vi.mocked(createDocument)
const deleteDocumentMock = vi.mocked(deleteDocument)
const getDocumentMock = vi.mocked(getDocument)
const updateDocumentMock = vi.mocked(updateDocument)
const uploadDocumentFileMock = vi.mocked(uploadDocumentFile)
const getPhotoMock = vi.mocked(getPhoto)

function makeConfig(overrides: Partial<NostromoConfig> = {}): NostromoConfig {
  return {
    baseUrl: BASE_URL,
    email: 'coach@example.com',
    token: TOKEN,
    userId: USER_ID,
    ...overrides,
  }
}

function makeDocument(version: number, overrides: Partial<NostromoDocument> = {}): NostromoDocument {
  return {
    id: 'aaaaaaaaaaaaaaa',
    owner: USER_ID,
    updated: '2026-09-16 06:00:00.000Z',
    version,
    ...overrides,
  }
}

function clientError(kind: NostromoErrorKind, status?: number): NostromoClientError {
  const message = `the server refused this call (${kind})`
  return status === undefined
    ? new NostromoClientError(message, { kind })
    : new NostromoClientError(message, { kind, status })
}

function makeBlob(content = 'photo-bytes'): Blob {
  return new Blob([content], { type: 'image/webp' })
}

/** Answers every create with the id the engine asked for. */
function serveCreate(version = 1): void {
  createDocumentMock.mockImplementation((_baseUrl, _token, input: NostromoCreateDocumentInput) =>
    Promise.resolve(makeDocument(version, { id: input.id }))
  )
}

function hasLog(level: 'error' | 'info' | 'warn', fragment: string): boolean {
  return getNostromoLog().some((entry) => entry.level === level && entry.message.includes(fragment))
}

/** Reads the persisted baselines envelope, exactly like the sync store writes it. */
function readStoredBaselines(): NostromoBaselines {
  const raw = localStorage.getItem(STORAGE_NOSTROMO_BASELINES_KEY)
  return raw ? (JSON.parse(raw) as { data: NostromoBaselines }).data : {}
}

beforeEach(() => {
  vi.clearAllMocks()
  getPhotoMock.mockReset()
  stopNostromoAutoSync()
  clearAllNostromoConflicts()
  localStorage.clear()
  hydrateClubs([])
  hydrateContacts([])
  hydrateMatchs([])
  hydratePlayers([])
  hydrateTeams([])
  hydrateNostromoSync()
  hydrateNostromoConfig(makeConfig())
})

afterEach(async () => {
  stopNostromoAutoSync()
  vi.useRealTimers()
  Reflect.deleteProperty(document, 'visibilityState')
  await clearAllPhotos()
})

describe('push-engine', () => {
  it('does nothing when the outbox is empty', async () => {
    await flushNostromoPush()

    expect(createDocumentMock).not.toHaveBeenCalled()
    expect(updateDocumentMock).not.toHaveBeenCalled()
    expect(getNostromoSyncStatus()).toBe('off')
  })

  it('stays off and keeps the outbox when there is no configuration', async () => {
    hydrateNostromoConfig(undefined)
    setDirtyUnits(['clubs'])

    await flushNostromoPush()

    expect(getNostromoSyncStatus()).toBe('off')
    expect(getDirtyUnits()).toEqual(['clubs'])
    expect(createDocumentMock).not.toHaveBeenCalled()
    expect(hasLog('info', 'pas configuré')).toBe(true)
  })

  it('pushes the dirty collections in the fixed order, with a schema envelope', async () => {
    serveCreate()
    hydrateClubs([{ id: 'c1', name: 'BC Clapiers' }])
    hydratePlayers([{ firstName: 'Nina', id: 'p1' }])
    setDirtyUnits(['players', 'clubs'])

    await flushNostromoPush()

    expect(createDocumentMock.mock.calls.map((call) => call[2].id)).toEqual([
      collectionDocId('clubs'),
      collectionDocId('players'),
    ])
    expect(createDocumentMock.mock.calls[0][2]).toEqual({
      id: collectionDocId('clubs'),
      owner: USER_ID,
      payload: { items: [{ id: 'c1', name: 'BC Clapiers' }], name: 'clubs', schema: 1, type: 'collection' },
    })
    expect(createDocumentMock.mock.calls[1][2].payload).toEqual({
      items: [{ firstName: 'Nina', id: 'p1' }],
      name: 'players',
      schema: 1,
      type: 'collection',
    })
    expect(getDirtyUnits()).toEqual([])
    expect(getNostromoSyncStatus()).toBe('saved')
    // The engine reads the stores through their clone getters: it never persists them.
    expect(localStorage.getItem('BS_CLUBS')).toBeNull()
  })

  it('derives one stable 15-character document id per collection, disjoint from the photo ids', () => {
    const ids = COLLECTIONS.map((unit) => collectionDocId(unit))

    expect(ids.every((id) => DOCUMENT_ID_PATTERN.test(id))).toBe(true)
    expect(new Set(ids).size).toBe(COLLECTIONS.length)
    expect(collectionDocId('clubs')).toBe(collectionDocId('clubs'))
    expect(collectionDocId('clubs')).not.toBe(photoDocId('clubs'))
  })

  it('creates on the first push, then updates with the version held in the baseline', async () => {
    serveCreate(3)
    setDirtyUnits(['clubs'])

    await flushNostromoPush()

    expect(createDocumentMock).toHaveBeenCalledTimes(1)
    expect(getBaseline('clubs')).toEqual({
      docId: collectionDocId('clubs'),
      savedAt: expect.any(Number),
      version: 3,
    })

    updateDocumentMock.mockResolvedValue(makeDocument(4))
    setDirtyUnits(['clubs'])

    await flushNostromoPush()

    expect(updateDocumentMock).toHaveBeenCalledTimes(1)
    expect(updateDocumentMock).toHaveBeenCalledWith(BASE_URL, TOKEN, collectionDocId('clubs'), {
      expectedVersion: 3,
      payload: { items: [], name: 'clubs', schema: 1, type: 'collection' },
    })
    expect(getBaseline('clubs')?.version).toBe(4)
    expect(getDirtyUnits()).toEqual([])
    expect(getNostromoSyncStatus()).toBe('saved')
    expect(hasLog('info', 'Envoi de clubs (version 4)')).toBe(true)
  })

  it('recreates a baselined document the server no longer holds instead of looping on the 404', async () => {
    // A full wipe pushed from another device deletes the remote documents: the
    // stale baseline must not turn every later update into a 404 error.
    setBaseline('clubs', { docId: collectionDocId('clubs'), savedAt: 1, version: 5 })
    updateDocumentMock.mockRejectedValue(clientError('notfound', 404))
    serveCreate(6)
    setDirtyUnits(['clubs'])

    await flushNostromoPush()

    expect(updateDocumentMock).toHaveBeenCalledTimes(1)
    expect(createDocumentMock).toHaveBeenCalledTimes(1)
    expect(createDocumentMock.mock.calls[0][2].id).toBe(collectionDocId('clubs'))
    expect(getBaseline('clubs')?.version).toBe(6)
    expect(getDirtyUnits()).toEqual([])
    expect(getNostromoSyncStatus()).toBe('saved')
    expect(hasLog('warn', 'Document distant de clubs introuvable (404)')).toBe(true)
  })

  it('adopts an existing document when the create is refused, then converges in the same run', async () => {
    createDocumentMock.mockRejectedValue(clientError('validation', 400))
    getDocumentMock.mockResolvedValue(makeDocument(7, { id: collectionDocId('clubs') }))
    updateDocumentMock.mockResolvedValue(makeDocument(8))
    hydrateClubs([{ id: 'c1', name: 'BC Clapiers' }])
    setDirtyUnits(['clubs'])

    await flushNostromoPush()

    expect(getDocumentMock).toHaveBeenCalledWith(BASE_URL, TOKEN, collectionDocId('clubs'))
    expect(updateDocumentMock).toHaveBeenCalledWith(BASE_URL, TOKEN, collectionDocId('clubs'), {
      expectedVersion: 7,
      payload: { items: [{ id: 'c1', name: 'BC Clapiers' }], name: 'clubs', schema: 1, type: 'collection' },
    })
    expect(getBaseline('clubs')?.version).toBe(8)
    expect(getDirtyUnits()).toEqual([])
    expect(getNostromoSyncStatus()).toBe('saved')
    expect(hasLog('warn', 'Document existant de clubs')).toBe(true)
  })

  it('adopts the server version of an empty collection without pushing the empty default', async () => {
    createDocumentMock.mockRejectedValue(clientError('validation', 400))
    getDocumentMock.mockResolvedValue(makeDocument(7, { id: collectionDocId('clubs') }))
    setDirtyUnits(['clubs'])

    await flushNostromoPush()

    expect(updateDocumentMock).not.toHaveBeenCalled()
    expect(getBaseline('clubs')).toEqual({
      docId: collectionDocId('clubs'),
      savedAt: expect.any(Number),
      version: 7,
    })
    expect(readStoredBaselines().clubs?.version).toBe(7)
    expect(getDirtyUnits()).toEqual([])
    expect(getNostromoSyncStatus()).toBe('saved')
    const adopted = 'Document existant de clubs adopté (version 7) sans envoyer de données locales vides.'
    expect(hasLog('info', adopted)).toBe(true)
    expect(hasLog('info', 'Envoi de clubs')).toBe(false)
    // The local state is left exactly as it was: pulling the server content is the user's call.
    expect(localStorage.getItem('BS_CLUBS')).toBeNull()
  })

  it('adopts the server version of a blank title without pushing it', async () => {
    createDocumentMock.mockRejectedValue(clientError('validation', 400))
    getDocumentMock.mockResolvedValue(makeDocument(4, { id: collectionDocId('trombiTitles') }))
    setDirtyUnits(['trombiTitles'])

    await flushNostromoPush()

    expect(getTitles().teamName).toBe('')
    expect(updateDocumentMock).not.toHaveBeenCalled()
    expect(getBaseline('trombiTitles')).toEqual({
      docId: collectionDocId('trombiTitles'),
      savedAt: expect.any(Number),
      version: 4,
    })
    expect(getDirtyUnits()).toEqual([])
    expect(getNostromoSyncStatus()).toBe('saved')
    expect(hasLog('info', 'Document existant de trombiTitles adopté (version 4)')).toBe(true)
  })

  it('reports an error when the refused create cannot be read back', async () => {
    createDocumentMock.mockRejectedValue(clientError('validation', 400))
    getDocumentMock.mockRejectedValue(clientError('notfound', 404))
    setDirtyUnits(['clubs'])

    await flushNostromoPush()

    expect(getNostromoSyncStatus()).toBe('error')
    expect(getDirtyUnits()).toEqual(['clubs'])
    expect(getBaseline('clubs')).toBeUndefined()
    expect(updateDocumentMock).not.toHaveBeenCalled()
    expect(hasLog('warn', "L'envoi de clubs a échoué")).toBe(true)
  })

  it('parks a unit on a 409, lets the other units through and skips the parked unit', async () => {
    setBaseline('clubs', { docId: collectionDocId('clubs'), savedAt: 1, version: 5 })
    updateDocumentMock.mockImplementation((_baseUrl, _token, id) =>
      id === collectionDocId('clubs') ? Promise.reject(clientError('conflict', 409)) : Promise.resolve(makeDocument(6))
    )
    serveCreate(2)
    setDirtyUnits(['clubs', 'players'])

    await flushNostromoPush()

    expect(getNostromoSyncStatus()).toBe('conflict')
    expect(getConflictedUnits()).toEqual(['clubs'])
    expect(getDirtyUnits()).toEqual(['clubs'])
    expect(getBaseline('clubs')?.version).toBe(5)
    expect(getBaseline('players')?.version).toBe(2)
    expect(hasLog('error', 'Conflit sur clubs')).toBe(true)
    // The parking lives on the baseline, so it survives a reload.
    expect(getBaseline('clubs')?.conflicted).toBe(true)
    expect(readStoredBaselines().clubs?.conflicted).toBe(true)

    const parkedWrites = countClubUpdates()
    await flushNostromoPush()
    expect(countClubUpdates()).toBe(parkedWrites)

    resolveNostromoConflict('clubs')
    expect(getConflictedUnits()).toEqual([])
    expect(getBaseline('clubs')?.conflicted).toBeUndefined()
    await flushNostromoPush()
    expect(countClubUpdates()).toBe(parkedWrites + 1)
  })

  it('keeps a unit parked after a reload, from the persisted baseline', async () => {
    setBaseline('clubs', { conflicted: true, docId: collectionDocId('clubs'), savedAt: 1, version: 5 })
    // A reload hydrates exactly what was persisted: the parking comes back with it.
    hydrateNostromoSync({ baselines: readStoredBaselines(), outbox: ['clubs'] })
    serveCreate()

    expect(getConflictedUnits()).toEqual(['clubs'])

    await flushNostromoPush()

    expect(createDocumentMock).not.toHaveBeenCalled()
    expect(updateDocumentMock).not.toHaveBeenCalled()
    expect(getDirtyUnits()).toEqual(['clubs'])
    expect(getBaseline('clubs')?.version).toBe(5)
  })

  it('stops the whole run on a 401 and asks for a fresh session', async () => {
    createDocumentMock.mockRejectedValue(clientError('auth', 401))
    setDirtyUnits(['clubs', 'players'])

    await flushNostromoPush()

    expect(getNostromoSyncStatus()).toBe('auth-required')
    expect(createDocumentMock).toHaveBeenCalledTimes(1)
    expect(getDirtyUnits()).toEqual(['clubs', 'players'])
  })

  it('keeps a failed unit queued and pushes the next one', async () => {
    createDocumentMock.mockImplementation((_baseUrl, _token, input) =>
      input.id === collectionDocId('clubs')
        ? Promise.reject(clientError('network'))
        : Promise.resolve(makeDocument(1, { id: input.id }))
    )
    setDirtyUnits(['clubs', 'players'])

    await flushNostromoPush()

    expect(createDocumentMock).toHaveBeenCalledTimes(2)
    expect(getDirtyUnits()).toEqual(['clubs'])
    expect(getNostromoSyncStatus()).toBe('error')
    expect(getBaseline('players')?.version).toBe(1)
  })

  it('drops an unknown unit instead of retrying it forever', async () => {
    serveCreate()
    setDirtyUnits(['clubs', 'trombis'])

    await flushNostromoPush()

    expect(getDirtyUnits()).toEqual([])
    expect(getConflictedUnits()).toEqual([])
    expect(hasLog('warn', 'Élément inconnu « trombis »')).toBe(true)
  })

  it('keeps a unit queued when it is marked again while its push is in flight', async () => {
    createDocumentMock.mockImplementation((_baseUrl, _token, input: NostromoCreateDocumentInput) => {
      // A local edit lands between the write and the acknowledgement.
      markUnitDirty('clubs')
      return Promise.resolve(makeDocument(1, { id: input.id }))
    })
    setDirtyUnits(['clubs'])

    await flushNostromoPush()

    expect(createDocumentMock).toHaveBeenCalledTimes(1)
    expect(getDirtyUnits()).toEqual(['clubs'])
    expect(getNostromoSyncStatus()).toBe('pending')
    expect(hasLog('warn', 'clubs a changé pendant son envoi')).toBe(true)

    // The follow-up push sends the fresh content and only then closes the unit.
    updateDocumentMock.mockResolvedValue(makeDocument(2))

    await flushNostromoPush()

    expect(updateDocumentMock).toHaveBeenCalledWith(BASE_URL, TOKEN, collectionDocId('clubs'), {
      expectedVersion: 1,
      payload: { items: [], name: 'clubs', schema: 1, type: 'collection' },
    })
    expect(getDirtyUnits()).toEqual([])
    expect(getNostromoSyncStatus()).toBe('saved')
  })

  it('re-exports the dirty marks next to the flush', () => {
    // The pull engine imports them from here: this is a contract, not a detail.
    expect(reExportedMarkCollectionDirty).toBe(markCollectionDirty)
    expect(DIRTY_DEBOUNCE_MS).toBe(10_000)
    expect(photoUnitName('p1')).toBe('photo:p1')
  })
})

function countClubUpdates(): number {
  return updateDocumentMock.mock.calls.filter((call) => call[2] === collectionDocId('clubs')).length
}

describe('push-engine photos', () => {
  it('creates the photo document, uploads the file and keeps the upload version', async () => {
    createDocumentMock.mockResolvedValue(makeDocument(1, { id: photoDocId('p1') }))
    uploadDocumentFileMock.mockResolvedValue(makeDocument(2, { id: photoDocId('p1') }))
    getPhotoMock.mockResolvedValue(makeBlob())

    await storePhoto('p1', makeBlob())
    expect(getDirtyUnits()).toEqual([photoUnitName('p1')])

    await flushNostromoPush()

    expect(createDocumentMock).toHaveBeenCalledWith(BASE_URL, TOKEN, {
      id: photoDocId('p1'),
      owner: USER_ID,
      payload: { playerId: 'p1', schema: 1, type: 'photo' },
    })
    expect(uploadDocumentFileMock).toHaveBeenCalledWith(BASE_URL, TOKEN, photoDocId('p1'), {
      expectedVersion: 1,
      file: expect.any(Blob),
      filename: 'p1.webp',
    })
    expect(getBaseline(photoUnitName('p1'))?.version).toBe(2)
    expect(getDirtyUnits()).toEqual([])
    expect(getNostromoSyncStatus()).toBe('saved')
  })

  it('updates the photo document before uploading when a baseline exists', async () => {
    const playerId = 'p2'
    const unit = photoUnitName(playerId)
    setBaseline(unit, { docId: photoDocId(playerId), savedAt: 1, version: 5 })
    updateDocumentMock.mockResolvedValue(makeDocument(6, { id: photoDocId(playerId) }))
    uploadDocumentFileMock.mockResolvedValue(makeDocument(7, { id: photoDocId(playerId) }))
    getPhotoMock.mockResolvedValue(makeBlob())

    await storePhoto(playerId, makeBlob())
    await flushNostromoPush()

    expect(createDocumentMock).not.toHaveBeenCalled()
    expect(updateDocumentMock).toHaveBeenCalledWith(BASE_URL, TOKEN, photoDocId(playerId), {
      expectedVersion: 5,
      payload: { playerId, schema: 1, type: 'photo' },
    })
    expect(uploadDocumentFileMock).toHaveBeenCalledWith(BASE_URL, TOKEN, photoDocId(playerId), {
      expectedVersion: 6,
      file: expect.any(Blob),
      filename: 'p2.webp',
    })
    expect(getBaseline(unit)?.version).toBe(7)
    expect(getDirtyUnits()).toEqual([])
  })

  it('recreates the document of a photo whose remote document was deleted', async () => {
    const playerId = 'p9'
    const unit = photoUnitName(playerId)
    setBaseline(unit, { docId: photoDocId(playerId), savedAt: 1, version: 5 })
    updateDocumentMock.mockRejectedValue(clientError('notfound', 404))
    serveCreate(6)
    uploadDocumentFileMock.mockResolvedValue(makeDocument(7, { id: photoDocId(playerId) }))
    getPhotoMock.mockResolvedValue(makeBlob())

    await storePhoto(playerId, makeBlob())
    await flushNostromoPush()

    expect(createDocumentMock).toHaveBeenCalledTimes(1)
    expect(uploadDocumentFileMock).toHaveBeenCalledWith(BASE_URL, TOKEN, photoDocId(playerId), {
      expectedVersion: 6,
      file: expect.any(Blob),
      filename: 'p9.webp',
    })
    expect(getBaseline(unit)?.version).toBe(7)
    expect(getDirtyUnits()).toEqual([])
    expect(getNostromoSyncStatus()).toBe('saved')
  })

  it('adopts an existing photo document when the create is refused', async () => {
    const playerId = 'p3'
    const unit = photoUnitName(playerId)
    createDocumentMock.mockRejectedValue(clientError('validation', 400))
    getDocumentMock.mockResolvedValue(makeDocument(5, { id: photoDocId(playerId) }))
    uploadDocumentFileMock.mockResolvedValue(makeDocument(6, { id: photoDocId(playerId) }))
    getPhotoMock.mockResolvedValue(makeBlob())

    await storePhoto(playerId, makeBlob())
    await flushNostromoPush()

    // A photo is never "empty local data": the local image goes over the adopted version.
    expect(updateDocumentMock).not.toHaveBeenCalled()
    expect(uploadDocumentFileMock).toHaveBeenCalledWith(BASE_URL, TOKEN, photoDocId(playerId), {
      expectedVersion: 5,
      file: expect.any(Blob),
      filename: 'p3.webp',
    })
    expect(getBaseline(unit)?.version).toBe(6)
    expect(getDirtyUnits()).toEqual([])
    expect(hasLog('warn', `Document existant de ${unit} adopté (version 5)`)).toBe(true)
  })

  it('drops a queued photo whose blob is gone and whose server copy is unknown', async () => {
    getPhotoMock.mockResolvedValue(undefined)
    setDirtyUnits([photoUnitName('ghost')])

    await flushNostromoPush()

    expect(createDocumentMock).not.toHaveBeenCalled()
    expect(deleteDocumentMock).not.toHaveBeenCalled()
    expect(getDirtyUnits()).toEqual([])
    expect(hasLog('warn', "La photo du joueur ghost n'est pas stockée localement")).toBe(true)
  })

  it('deletes the remote document of a photo whose local copy was deleted', async () => {
    const playerId = 'gone'
    const unit = photoUnitName(playerId)
    setBaseline(unit, { docId: photoDocId(playerId), savedAt: 1, version: 4 })
    getPhotoMock.mockResolvedValue(undefined)
    deleteDocumentMock.mockResolvedValue(undefined)
    setDirtyUnits([unit])

    await flushNostromoPush()

    expect(deleteDocumentMock).toHaveBeenCalledWith(BASE_URL, TOKEN, photoDocId(playerId))
    expect(getBaseline(unit)).toBeUndefined()
    expect(getDirtyUnits()).toEqual([])
    expect(getNostromoSyncStatus()).toBe('saved')
    expect(hasLog('info', 'Photo distante du joueur gone supprimée')).toBe(true)
  })

  it('clears a deleted photo whose remote document is already gone', async () => {
    const playerId = 'already-gone'
    const unit = photoUnitName(playerId)
    setBaseline(unit, { docId: photoDocId(playerId), savedAt: 1, version: 2 })
    getPhotoMock.mockResolvedValue(undefined)
    deleteDocumentMock.mockRejectedValue(clientError('notfound', 404))
    setDirtyUnits([unit])

    await flushNostromoPush()

    expect(getBaseline(unit)).toBeUndefined()
    expect(getDirtyUnits()).toEqual([])
    expect(getNostromoSyncStatus()).toBe('saved')
  })

  it('keeps a deleted photo queued and its baseline intact when the remote deletion fails', async () => {
    const playerId = 'offline'
    const unit = photoUnitName(playerId)
    setBaseline(unit, { docId: photoDocId(playerId), savedAt: 1, version: 6 })
    getPhotoMock.mockResolvedValue(undefined)
    deleteDocumentMock.mockRejectedValue(clientError('network'))
    setDirtyUnits([unit])

    await flushNostromoPush()

    expect(getBaseline(unit)?.version).toBe(6)
    expect(getDirtyUnits()).toEqual([unit])
    expect(getNostromoSyncStatus()).toBe('error')
    expect(hasLog('warn', `L'envoi de ${unit} a échoué`)).toBe(true)
  })

  it('keeps a photo above the size ceiling queued and reports an error', async () => {
    const playerId = 'big'
    getPhotoMock.mockResolvedValue(new Blob([new ArrayBuffer(NOSTROMO_MAX_PHOTO_BYTES + 1)]))
    setDirtyUnits([photoUnitName(playerId)])

    await flushNostromoPush()

    expect(createDocumentMock).not.toHaveBeenCalled()
    expect(uploadDocumentFileMock).not.toHaveBeenCalled()
    expect(getDirtyUnits()).toEqual([photoUnitName(playerId)])
    expect(getNostromoSyncStatus()).toBe('error')
    expect(hasLog('error', 'au-dessus de la limite')).toBe(true)
  })
})

describe('push-engine debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('queues a marked collection and pushes it once the window closes', async () => {
    serveCreate()
    markCollectionDirty('clubs')

    expect(getDirtyUnits()).toEqual(['clubs'])
    expect(getNostromoSyncStatus()).toBe('pending')
    expect(createDocumentMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(DIRTY_DEBOUNCE_MS)

    expect(createDocumentMock).toHaveBeenCalledTimes(1)
    expect(getDirtyUnits()).toEqual([])
    expect(getNostromoSyncStatus()).toBe('saved')
  })

  it('slides the window: a second edit delays the single push', async () => {
    serveCreate()
    markCollectionDirty('clubs')
    await vi.advanceTimersByTimeAsync(DIRTY_DEBOUNCE_MS / 2)

    markCollectionDirty('teams')
    await vi.advanceTimersByTimeAsync(DIRTY_DEBOUNCE_MS - 1)
    expect(createDocumentMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(createDocumentMock).toHaveBeenCalledTimes(2)
    expect(getDirtyUnits()).toEqual([])
  })

  it('marks the unit without arming a push while unconfigured', async () => {
    hydrateNostromoConfig(undefined)
    markCollectionDirty('clubs')

    expect(getDirtyUnits()).toEqual(['clubs'])
    expect(getNostromoSyncStatus()).toBe('off')

    await vi.advanceTimersByTimeAsync(DIRTY_DEBOUNCE_MS * 5)

    expect(createDocumentMock).not.toHaveBeenCalled()
    expect(getDirtyUnits()).toEqual(['clubs'])
  })

  it('marks a photo unit and ignores an empty player id', () => {
    markPhotoDirty('p9')
    markPhotoDirty('')

    expect(getDirtyUnits()).toEqual([photoUnitName('p9')])
  })
})

describe('push-engine auto-sync', () => {
  it('installs one interval and one visibility listener, however many times it starts', () => {
    const addListener = vi.spyOn(document, 'addEventListener')

    startNostromoAutoSync()
    startNostromoAutoSync()

    expect(addListener.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(1)
    addListener.mockRestore()
  })

  it('retries on its interval only with dirty units and a configuration', async () => {
    vi.useFakeTimers()
    startNostromoAutoSync()

    await vi.advanceTimersByTimeAsync(NOSTROMO_RETRY_INTERVAL_MS)
    expect(createDocumentMock).not.toHaveBeenCalled()

    serveCreate()
    setDirtyUnits(['clubs'])
    await vi.advanceTimersByTimeAsync(NOSTROMO_RETRY_INTERVAL_MS)

    expect(createDocumentMock).toHaveBeenCalledTimes(1)
    expect(getDirtyUnits()).toEqual([])
  })

  it('pushes the outbox when the tab becomes hidden', async () => {
    serveCreate()
    setDirtyUnits(['clubs'])
    startNostromoAutoSync()
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })

    document.dispatchEvent(new Event('visibilitychange'))

    await vi.waitFor(() => {
      expect(createDocumentMock).toHaveBeenCalledTimes(1)
      expect(getDirtyUnits()).toEqual([])
    })
  })
})
