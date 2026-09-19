import { clear, createStore, get } from 'idb-keyval'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearAllPhotos } from '../photo-store/photo-store'
import { getRawPlayers, hydratePlayers } from '../stores/players-store'
import {
  createDocument,
  downloadFile,
  getDocument,
  getFileToken,
  listDocuments,
  NostromoClientError,
  updateDocument,
  uploadDocumentFile,
} from './client'
import type { NostromoDocument } from './client.d'
import { getConfig, isConfigured } from './nostromo-config-store'
import type { NostromoConfig } from './nostromo-config-store.d'
import { getDirtyUnits, pushNostromoLog, setBaselines, setDirtyUnits } from './nostromo-sync-store'
import {
  captureRemoteSnapshot,
  describeRemoteSnapshot,
  hasRemoteSnapshot,
  restoreRemoteSnapshot,
} from './remote-snapshot'

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return {
    ...actual,
    createDocument: vi.fn(),
    downloadFile: vi.fn(),
    getDocument: vi.fn(),
    getFileToken: vi.fn(),
    listDocuments: vi.fn(),
    updateDocument: vi.fn(),
    uploadDocumentFile: vi.fn(),
  }
})

vi.mock('./nostromo-config-store', () => ({
  getConfig: vi.fn(),
  isConfigured: vi.fn(() => true),
}))

vi.mock('./nostromo-sync-store', () => ({
  getDirtyUnits: vi.fn(() => []),
  markUnitDirty: vi.fn(),
  pushNostromoLog: vi.fn(),
  setBaselines: vi.fn(),
  setDirtyUnits: vi.fn(),
  setNostromoSyncStatus: vi.fn(),
}))

const CONFIG: NostromoConfig = {
  baseUrl: 'https://nostromo.test',
  email: 'coach@club.fr',
  token: 'auth-token-raw',
  userId: 'user-owner-0001',
}

const PLAYERS_DOC_ID = 'pl0000000000001'
const PHOTO_DOC_ID = 'ph0000000000001'
const PLAYER_ID = 'p1'
const PLAYERS_UNIT = 'players'
const PHOTO_UNIT = `photo:${PLAYER_ID}`
const UPDATED = '2026-01-01 00:00:00.000Z'
const FILE_TOKEN = 'file-token-short-lived'
const SNAPSHOT_STORE = createStore('nostromo-snapshots-db', 'snapshots')

function collectionDocument(version = 1): NostromoDocument {
  return {
    id: PLAYERS_DOC_ID,
    owner: CONFIG.userId,
    payload: { items: [{ id: PLAYER_ID }], name: PLAYERS_UNIT, schema: 1, type: 'collection' },
    updated: UPDATED,
    version,
  }
}

function photoDocument(version = 1): NostromoDocument {
  return {
    file: `${PLAYER_ID}.webp`,
    id: PHOTO_DOC_ID,
    owner: CONFIG.userId,
    payload: { playerId: PLAYER_ID, schema: 1, type: 'photo' },
    updated: UPDATED,
    version,
  }
}

function listResult(items: NostromoDocument[]) {
  return { items, page: 1, perPage: 500, totalItems: items.length }
}

async function seedSnapshot(): Promise<void> {
  vi.mocked(listDocuments).mockResolvedValue(listResult([collectionDocument(), photoDocument()]))
  vi.mocked(getFileToken).mockResolvedValue(FILE_TOKEN)
  vi.mocked(downloadFile).mockResolvedValue(new Blob(['image-bytes'], { type: 'image/webp' }))
  await captureRemoteSnapshot('vidage')
}

beforeEach(async () => {
  vi.clearAllMocks()
  vi.mocked(isConfigured).mockReturnValue(true)
  vi.mocked(getConfig).mockReturnValue(CONFIG)
  vi.mocked(getDirtyUnits).mockReturnValue([])
  vi.mocked(listDocuments).mockResolvedValue(listResult([]))
  vi.mocked(getFileToken).mockResolvedValue(FILE_TOKEN)
  vi.mocked(downloadFile).mockResolvedValue(new Blob(['image-bytes'], { type: 'image/webp' }))
  hydratePlayers([])
  await clearAllPhotos()
  await clear(SNAPSHOT_STORE)
})

describe('captureRemoteSnapshot', () => {
  it('captures the collection and photo documents with their files', async () => {
    vi.mocked(listDocuments).mockResolvedValue(listResult([collectionDocument(), photoDocument()]))

    await captureRemoteSnapshot('vidage')

    const description = await describeRemoteSnapshot()
    expect(description).toMatchObject({ collectionCount: 1, photoCount: 1, reason: 'vidage' })
    expect(getFileToken).toHaveBeenCalledTimes(1)
    expect(downloadFile).toHaveBeenCalledWith(CONFIG.baseUrl, FILE_TOKEN, PHOTO_DOC_ID, `${PLAYER_ID}.webp`)
    await expect(hasRemoteSnapshot()).resolves.toBe(true)
  })

  it('keeps only the most recent snapshot', async () => {
    await seedSnapshot()
    vi.mocked(listDocuments).mockResolvedValue(listResult([collectionDocument()]))
    await captureRemoteSnapshot('import de sauvegarde')

    const description = await describeRemoteSnapshot()
    expect(description?.reason).toBe('import de sauvegarde')
    expect(description?.photoCount).toBe(0)
  })

  it('skips a photo whose download fails and keeps the rest', async () => {
    vi.mocked(listDocuments).mockResolvedValue(listResult([collectionDocument(), photoDocument()]))
    vi.mocked(downloadFile).mockRejectedValue(new Error('offline'))

    await captureRemoteSnapshot('vidage')

    const description = await describeRemoteSnapshot()
    expect(description).toMatchObject({ collectionCount: 1, photoCount: 0 })
    expect(pushNostromoLog).toHaveBeenCalledWith('warn', expect.stringContaining('capturée'))
  })

  it('makes no client call when Nostromo is unconfigured', async () => {
    vi.mocked(isConfigured).mockReturnValue(false)
    vi.mocked(getConfig).mockReturnValue(undefined)

    await captureRemoteSnapshot('vidage')

    expect(listDocuments).not.toHaveBeenCalled()
    await expect(hasRemoteSnapshot()).resolves.toBe(false)
  })
})

describe('restoreRemoteSnapshot', () => {
  it('writes the snapshot back to the server, then applies it locally', async () => {
    await seedSnapshot()
    // The live server holds the same documents: the upsert must expect their current version.
    vi.mocked(listDocuments).mockResolvedValue(listResult([collectionDocument(4), photoDocument(4)]))
    vi.mocked(updateDocument)
      .mockResolvedValueOnce({ ...collectionDocument(5), version: 5 })
      .mockResolvedValueOnce({ ...photoDocument(5), version: 5 })
    vi.mocked(uploadDocumentFile).mockResolvedValue({ ...photoDocument(6), version: 6 })
    vi.mocked(getDirtyUnits).mockReturnValue([PLAYERS_UNIT, PHOTO_UNIT])

    const result = await restoreRemoteSnapshot()

    expect(updateDocument).toHaveBeenCalledWith(CONFIG.baseUrl, CONFIG.token, PLAYERS_DOC_ID, {
      expectedVersion: 4,
      payload: collectionDocument(4).payload,
    })
    expect(uploadDocumentFile).toHaveBeenCalledWith(
      CONFIG.baseUrl,
      CONFIG.token,
      PHOTO_DOC_ID,
      expect.objectContaining({ expectedVersion: 5, file: expect.anything(), filename: `${PLAYER_ID}.webp` })
    )
    expect(result).toEqual({ collections: 1, failedUnits: [], photos: 1 })
    expect(getRawPlayers().map((player) => player.id)).toEqual([PLAYER_ID])
    expect(setBaselines).toHaveBeenCalledWith([
      { baseline: { docId: PLAYERS_DOC_ID, savedAt: expect.any(Number), version: 5 }, unit: PLAYERS_UNIT },
      { baseline: { docId: PHOTO_DOC_ID, savedAt: expect.any(Number), version: 6 }, unit: PHOTO_UNIT },
    ])
    expect(setDirtyUnits).toHaveBeenCalledWith([])
  })

  it('creates the documents the server no longer holds', async () => {
    await seedSnapshot()
    vi.mocked(listDocuments).mockResolvedValue(listResult([]))
    vi.mocked(createDocument).mockResolvedValue(collectionDocument(1))

    const result = await restoreRemoteSnapshot()

    expect(createDocument).toHaveBeenCalledWith(CONFIG.baseUrl, CONFIG.token, {
      id: PLAYERS_DOC_ID,
      owner: CONFIG.userId,
      payload: collectionDocument().payload,
    })
    expect(result.failedUnits).toEqual([])
  })

  it('adopts the live document when the create is refused because the id is taken', async () => {
    await seedSnapshot()
    // The listing does not show the snapshot id, but the server still holds it
    // under that id (e.g. a device created it after the listing was read).
    vi.mocked(listDocuments).mockResolvedValue(listResult([]))
    vi.mocked(createDocument).mockRejectedValue(
      new NostromoClientError('id taken', { kind: 'validation', status: 400 })
    )
    vi.mocked(getDocument).mockResolvedValue({ ...collectionDocument(7) })
    vi.mocked(updateDocument).mockResolvedValue({ ...collectionDocument(8), version: 8 })
    vi.mocked(uploadDocumentFile).mockResolvedValue({ ...photoDocument(9), version: 9 })

    const result = await restoreRemoteSnapshot()

    expect(getDocument).toHaveBeenCalledWith(CONFIG.baseUrl, CONFIG.token, PLAYERS_DOC_ID)
    expect(updateDocument).toHaveBeenCalledWith(CONFIG.baseUrl, CONFIG.token, PLAYERS_DOC_ID, {
      expectedVersion: 7,
      payload: collectionDocument().payload,
    })
    expect(result).toEqual({ collections: 1, failedUnits: [], photos: 1 })
  })

  it('refuses to restore without a snapshot', async () => {
    await expect(restoreRemoteSnapshot()).rejects.toThrow("Aucun instantané serveur n'est disponible.")
  })

  it('refuses to restore when Nostromo is unconfigured', async () => {
    vi.mocked(getConfig).mockReturnValue(undefined)

    await expect(restoreRemoteSnapshot()).rejects.toMatchObject({ kind: 'auth' })
  })

  it('reports a per-unit failure without failing the whole run', async () => {
    await seedSnapshot()
    vi.mocked(listDocuments).mockResolvedValue(listResult([collectionDocument(4)]))
    vi.mocked(updateDocument).mockRejectedValue(new Error('boom'))

    const result = await restoreRemoteSnapshot()

    expect(result.failedUnits).toContain(PLAYERS_UNIT)
    expect(result.collections).toBe(0)
  })
})

describe('snapshot storage', () => {
  it('stores a single record under the latest key', async () => {
    await seedSnapshot()
    const stored = await get('latest', SNAPSHOT_STORE)
    expect(stored).toBeDefined()
  })
})
