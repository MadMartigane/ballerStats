import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteDocument, listDocuments, NostromoClientError } from './client'
import type { NostromoDocument } from './client.d'
import { deleteOrphanRemotePhotos, listOrphanRemotePhotos } from './import-orphans'
import { getConfig, isConfigured } from './nostromo-config-store'
import type { NostromoConfig } from './nostromo-config-store.d'
import { clearBaseline, getDirtyUnits, pushNostromoLog } from './nostromo-sync-store'

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return {
    ...actual,
    deleteDocument: vi.fn(),
    listDocuments: vi.fn(),
  }
})

vi.mock('./nostromo-config-store', () => ({
  getConfig: vi.fn(),
  isConfigured: vi.fn(() => true),
}))

vi.mock('./nostromo-sync-store', () => ({
  clearBaseline: vi.fn(),
  getDirtyUnits: vi.fn(() => []),
  pushNostromoLog: vi.fn(),
}))

const CONFIG: NostromoConfig = {
  baseUrl: 'https://nostromo.test',
  email: 'coach@club.fr',
  token: 'auth-token-raw',
  userId: 'user-owner-0001',
}

const UPDATED = '2026-01-01 00:00:00.000Z'
const PLAYERS_UNIT = 'players'

function photoDocument(id: string, playerId: string): NostromoDocument {
  return {
    id,
    owner: CONFIG.userId,
    payload: { playerId, schema: 1, type: 'photo' },
    updated: UPDATED,
    version: 1,
  }
}

function collectionDocument(id: string, unit: string): NostromoDocument {
  return {
    id,
    owner: CONFIG.userId,
    payload: { items: [], name: unit, schema: 1, type: 'collection' },
    updated: UPDATED,
    version: 1,
  }
}

function listResult(items: NostromoDocument[]) {
  return { items, page: 1, perPage: 500, totalItems: items.length }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isConfigured).mockReturnValue(true)
  vi.mocked(getConfig).mockReturnValue(CONFIG)
  vi.mocked(getDirtyUnits).mockReturnValue([])
  vi.mocked(listDocuments).mockResolvedValue(listResult([]))
})

describe('listOrphanRemotePhotos', () => {
  it('returns the remote photos the archive does not hold', async () => {
    vi.mocked(listDocuments).mockResolvedValue(
      listResult([
        photoDocument('ph0000000000001', 'p1'),
        photoDocument('ph0000000000002', 'p2'),
        collectionDocument('pl0000000000001', PLAYERS_UNIT),
      ])
    )

    const orphans = await listOrphanRemotePhotos(new Set(['p1']))

    expect(orphans).toEqual([{ docId: 'ph0000000000002', playerId: 'p2', unit: 'photo:p2' }])
  })

  it('returns nothing when every remote photo is in the archive', async () => {
    vi.mocked(listDocuments).mockResolvedValue(
      listResult([photoDocument('ph0000000000001', 'p1'), collectionDocument('pl0000000000001', PLAYERS_UNIT)])
    )

    await expect(listOrphanRemotePhotos(new Set(['p1', 'p2']))).resolves.toEqual([])
  })

  it('does not list a photo whose deletion is already queued', async () => {
    vi.mocked(getDirtyUnits).mockReturnValue(['photo:p2'])
    vi.mocked(listDocuments).mockResolvedValue(listResult([photoDocument('ph0000000000002', 'p2')]))

    await expect(listOrphanRemotePhotos(new Set())).resolves.toEqual([])
  })

  it('ignores documents that are not readable photo payloads', async () => {
    const unreadable: NostromoDocument = {
      id: 'xx0000000000001',
      owner: CONFIG.userId,
      payload: { hello: 'world' },
      updated: UPDATED,
      version: 1,
    }
    vi.mocked(listDocuments).mockResolvedValue(listResult([unreadable]))

    await expect(listOrphanRemotePhotos(new Set())).resolves.toEqual([])
  })

  it('reuses the listing it is given instead of listing the remote state again', async () => {
    const documents = [photoDocument('ph0000000000002', 'p2')]

    const orphans = await listOrphanRemotePhotos(new Set(['p1']), documents)

    expect(listDocuments).not.toHaveBeenCalled()
    expect(orphans).toEqual([{ docId: 'ph0000000000002', playerId: 'p2', unit: 'photo:p2' }])
  })

  it('makes no network call when Nostromo is unconfigured', async () => {
    vi.mocked(isConfigured).mockReturnValue(false)
    vi.mocked(getConfig).mockReturnValue(undefined)

    await expect(listOrphanRemotePhotos(new Set())).resolves.toEqual([])
    expect(listDocuments).not.toHaveBeenCalled()
  })
})

describe('deleteOrphanRemotePhotos', () => {
  const orphan = { docId: 'ph0000000000002', playerId: 'p2', unit: 'photo:p2' }

  it('deletes each document and clears its stale baseline', async () => {
    vi.mocked(deleteDocument).mockResolvedValue(undefined)

    const result = await deleteOrphanRemotePhotos([orphan])

    expect(deleteDocument).toHaveBeenCalledWith(CONFIG.baseUrl, CONFIG.token, orphan.docId)
    expect(clearBaseline).toHaveBeenCalledWith(orphan.unit)
    expect(result).toEqual({ deleted: ['p2'], failed: [] })
  })

  it('tolerates a document the server no longer holds (404)', async () => {
    vi.mocked(deleteDocument).mockRejectedValue(new NostromoClientError('gone', { kind: 'notfound', status: 404 }))

    const result = await deleteOrphanRemotePhotos([orphan])

    expect(clearBaseline).toHaveBeenCalledWith(orphan.unit)
    expect(result).toEqual({ deleted: ['p2'], failed: [] })
  })

  it('reports a deletion that fails for another reason without throwing', async () => {
    vi.mocked(deleteDocument).mockRejectedValue(new NostromoClientError('offline', { kind: 'network' }))

    const result = await deleteOrphanRemotePhotos([orphan])

    expect(result).toEqual({ deleted: [], failed: [orphan.unit] })
    expect(clearBaseline).not.toHaveBeenCalled()
    expect(pushNostromoLog).toHaveBeenCalledWith('warn', expect.stringContaining('joueur p2'))
  })

  it('does nothing without an orphan', async () => {
    await expect(deleteOrphanRemotePhotos([])).resolves.toEqual({ deleted: [], failed: [] })
    expect(deleteDocument).not.toHaveBeenCalled()
  })
})
