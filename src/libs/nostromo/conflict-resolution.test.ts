import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRawClubs, hydrateClubs } from '../stores/clubs-store'
import { confirmAction } from '../utils/utils'
import { getDocument } from './client'
import type { NostromoDocument } from './client.d'
import { resolveConflict } from './conflict-resolution'
import { hydrateNostromoConfig } from './nostromo-config-store'
import {
  getBaseline,
  getConflictedUnits,
  getDirtyUnits,
  getNostromoSyncStatus,
  hydrateNostromoSync,
  markUnitDirty,
  setBaselines,
} from './nostromo-sync-store'
import { buildCollectionPayload } from './payload'
import { flushNostromoPush } from './push-engine'
import { collectionDocId } from './units'

vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  getDocument: vi.fn(),
}))
vi.mock('./push-engine', () => ({ flushNostromoPush: vi.fn(() => Promise.resolve()) }))
vi.mock('../utils/utils', () => ({ confirmAction: vi.fn(), toast: vi.fn() }))
vi.mock('../store/store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../store/store')>()),
  storeClubs: vi.fn(() => Promise.resolve()),
}))

const CONFIG = { baseUrl: 'http://localhost:8090', email: 'a@b.test', token: 'opaque-token', userId: 'user-1' }

function serverDocument(items: unknown[], version: number): NostromoDocument {
  return {
    id: collectionDocId('clubs'),
    owner: 'user-1',
    payload: buildCollectionPayload('clubs', items),
    updated: '2026-10-24 10:00:00.000Z',
    version,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  hydrateNostromoSync()
  hydrateNostromoConfig(CONFIG)
  hydrateClubs([{ id: 'mine' }] as never)
  setBaselines([
    { baseline: { conflicted: true, docId: collectionDocId('clubs'), savedAt: 1, version: 1 }, unit: 'clubs' },
  ])
  markUnitDirty('clubs')
  vi.mocked(confirmAction).mockResolvedValue(true)
})

describe('resolveConflict', () => {
  it('keep-local rebases on the server version, stays dirty and flushes', async () => {
    vi.mocked(getDocument).mockResolvedValue(serverDocument([{ id: 'theirs' }], 5))

    await resolveConflict('clubs', 'keep-local')

    expect(getBaseline('clubs')?.version).toBe(5)
    expect(getConflictedUnits()).toEqual([])
    expect(getDirtyUnits()).toEqual(['clubs'])
    expect(flushNostromoPush).toHaveBeenCalledTimes(1)
    expect(getRawClubs().map((club) => club.id)).toEqual(['mine'])
    expect(getNostromoSyncStatus()).toBe('pending')
  })

  it('take-server applies silently, sets the baseline and clears the dirty mark', async () => {
    vi.mocked(getDocument).mockResolvedValue(serverDocument([{ id: 'theirs' }], 5))

    await resolveConflict('clubs', 'take-server')

    expect(getRawClubs().map((club) => club.id)).toEqual(['theirs'])
    expect(getBaseline('clubs')).toMatchObject({ version: 5 })
    expect(getConflictedUnits()).toEqual([])
    expect(getDirtyUnits()).toEqual([])
    expect(getNostromoSyncStatus()).toBe('saved')
  })

  it('take-server refuses an invalid payload and changes nothing', async () => {
    vi.mocked(getDocument).mockResolvedValue({ ...serverDocument([], 5), payload: { nope: true } })

    await expect(resolveConflict('clubs', 'take-server')).rejects.toThrow('refusée')

    expect(getRawClubs().map((club) => club.id)).toEqual(['mine'])
    expect(getConflictedUnits()).toEqual(['clubs'])
    expect(getNostromoSyncStatus()).toBe('conflict')
  })

  it('does nothing when the confirmation is declined', async () => {
    vi.mocked(confirmAction).mockResolvedValue(false)

    await resolveConflict('clubs', 'take-server')

    expect(getDocument).not.toHaveBeenCalled()
    expect(getConflictedUnits()).toEqual(['clubs'])
  })

  it('asks the French confirmation of each choice', async () => {
    vi.mocked(getDocument).mockResolvedValue(serverDocument([], 5))

    await resolveConflict('clubs', 'keep-local')
    expect(vi.mocked(confirmAction).mock.calls[0]?.[1]).toBe(
      'Remplacer la copie du serveur par celle de cet appareil ?'
    )

    setBaselines([
      { baseline: { conflicted: true, docId: collectionDocId('clubs'), savedAt: 1, version: 5 }, unit: 'clubs' },
    ])
    await resolveConflict('clubs', 'take-server')
    expect(vi.mocked(confirmAction).mock.calls[1]?.[1]).toBe(
      'Remplacer les données de cet appareil par celles du serveur ?'
    )
  })
})
