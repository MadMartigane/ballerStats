import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deletePhoto, getAllPhotoEntries, storePhoto } from '../photo-store/photo-store'
import { getRawClubs, hydrateClubs } from '../stores/clubs-store'
import { getRawPlayers, hydratePlayers } from '../stores/players-store'
import { getTitles, updateTitle } from '../trombi-titles-store'
import { downloadFile, getDocument, listDocuments, NostromoClientError, photoDocId } from './client'
import type { NostromoDocument } from './client.d'
import { photoUnitName } from './dirty-marks'
import { hydrateNostromoConfig } from './nostromo-config-store'
import {
  getBaseline,
  getDirtyUnits,
  getNostromoLog,
  getNostromoSyncStatus,
  hydrateNostromoSync,
  markUnitDirty,
  setBaselines,
} from './nostromo-sync-store'
import { buildCollectionPayload } from './payload'
import { pullNostromo } from './pull-engine'
import { flushNostromoPush } from './push-engine'
import { collectionDocId } from './units'

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return {
    ...actual,
    downloadFile: vi.fn(),
    getDocument: vi.fn(),
    getFileToken: vi.fn(() => Promise.resolve('file-token')),
    listDocuments: vi.fn(),
  }
})

vi.mock('../photo-store/photo-store', () => ({
  deletePhoto: vi.fn(() => Promise.resolve()),
  getAllPhotoEntries: vi.fn(() => Promise.resolve([])),
  storePhoto: vi.fn(() => Promise.resolve()),
}))

vi.mock('./sync-notify', () => ({ notifySyncFailure: vi.fn(), notifySyncFailureStatus: vi.fn() }))

vi.mock('./push-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./push-engine')>()
  return { ...actual, flushNostromoPush: vi.fn(() => Promise.resolve()) }
})

vi.mock('../store/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/store')>()
  return {
    ...actual,
    storeClubs: vi.fn(() => Promise.resolve()),
    storeContacts: vi.fn(() => Promise.resolve()),
    storeMatchs: vi.fn(() => Promise.resolve()),
    storePlayers: vi.fn(() => Promise.resolve()),
    storeTeams: vi.fn(() => Promise.resolve()),
  }
})

const CONFIG = { baseUrl: 'http://localhost:8090', email: 'a@b.test', token: 'opaque-token', userId: 'user-1' }

function makeDocument(
  unit: Parameters<typeof collectionDocId>[0],
  items: unknown[],
  version: number
): NostromoDocument {
  return {
    id: collectionDocId(unit),
    owner: 'user-1',
    payload: buildCollectionPayload(unit, items),
    updated: '2026-10-24 10:00:00.000Z',
    version,
  }
}

function listRemote(documents: NostromoDocument[]): void {
  vi.mocked(listDocuments).mockResolvedValue({ items: documents, page: 1, perPage: 500, totalItems: documents.length })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  hydrateNostromoSync()
  hydrateNostromoConfig(CONFIG)
  hydrateClubs([])
  hydratePlayers([])
  vi.mocked(flushNostromoPush).mockResolvedValue(undefined)
})

describe('pullNostromo', () => {
  it('applies a remote unit without ever marking it dirty, then sets the baseline', async () => {
    listRemote([makeDocument('clubs', [{ id: 'c1', name: 'Club' }], 3)])

    const outcome = await pullNostromo()

    expect(outcome).toEqual({ kind: 'applied', units: ['clubs'] })
    expect(getRawClubs().map((club) => club.id)).toEqual(['c1'])
    expect(getDirtyUnits()).toEqual([])
    expect(getBaseline('clubs')?.version).toBe(3)
    expect(getNostromoSyncStatus()).toBe('saved')
    expect(getNostromoLog().map((entry) => entry.message)).toContain(
      'Unité « clubs » mise à jour depuis le serveur (version 3).'
    )
  })

  it('applies the titles unit without leaving it in the outbox', async () => {
    listRemote([makeDocument('trombiTitles', [{ teamName: 'Les Lions' }], 1)])

    await expect(pullNostromo()).resolves.toEqual({ kind: 'applied', units: ['trombiTitles'] })

    expect(getTitles().teamName).toBe('Les Lions')
    expect(getDirtyUnits()).toEqual([])
  })

  it('is idempotent: a second pull is up-to-date', async () => {
    listRemote([makeDocument('clubs', [{ id: 'c1' }], 2)])

    await pullNostromo()

    await expect(pullNostromo()).resolves.toEqual({ kind: 'up-to-date' })
    expect(listDocuments).toHaveBeenCalledTimes(2)
  })

  it('applies only the units whose remote version is greater than the baseline', async () => {
    const now = Date.now()
    setBaselines([
      { baseline: { docId: collectionDocId('clubs'), savedAt: now, version: 2 }, unit: 'clubs' },
      { baseline: { docId: collectionDocId('players'), savedAt: now, version: 1 }, unit: 'players' },
    ])
    listRemote([makeDocument('clubs', [{ id: 'c1' }], 2), makeDocument('players', [{ id: 'p1' }], 2)])

    await expect(pullNostromo()).resolves.toEqual({ kind: 'applied', units: ['players'] })

    expect(getRawClubs()).toEqual([])
    expect(getRawPlayers().map((player) => player.id)).toEqual(['p1'])
  })

  it('commits nothing when one payload is invalid', async () => {
    listRemote([makeDocument('clubs', [{ id: 'c1' }], 1), makeDocument('players', [{ name: 'no id' }], 1)])

    const outcome = await pullNostromo()

    expect(outcome.kind).toBe('error')
    expect(getRawClubs()).toEqual([])
    expect(getBaseline('clubs')).toBeUndefined()
    expect(getNostromoSyncStatus()).toBe('error')
  })

  it('skips with conflict-pending when a unit is still dirty after the drain', async () => {
    markUnitDirty('players')
    listRemote([makeDocument('clubs', [{ id: 'c1' }], 1)])

    await expect(pullNostromo()).resolves.toEqual({ kind: 'skipped', reason: 'conflict-pending' })

    expect(flushNostromoPush).toHaveBeenCalledTimes(1)
    expect(listDocuments).not.toHaveBeenCalled()
    expect(getRawClubs()).toEqual([])
  })

  it('skips with conflict-pending when a unit is parked', async () => {
    setBaselines([
      { baseline: { conflicted: true, docId: collectionDocId('clubs'), savedAt: 1, version: 1 }, unit: 'clubs' },
    ])

    await expect(pullNostromo()).resolves.toEqual({ kind: 'skipped', reason: 'conflict-pending' })
    expect(listDocuments).not.toHaveBeenCalled()
  })

  it('skips quietly when unconfigured', async () => {
    hydrateNostromoConfig(undefined)

    await expect(pullNostromo()).resolves.toEqual({ kind: 'skipped', reason: 'unconfigured' })
    expect(flushNostromoPush).not.toHaveBeenCalled()
  })

  it('maps a network failure to skipped/offline and an auth failure to auth-required', async () => {
    vi.mocked(listDocuments).mockRejectedValueOnce(new NostromoClientError('down', { kind: 'network' }))
    await expect(pullNostromo()).resolves.toEqual({ kind: 'skipped', reason: 'offline' })

    vi.mocked(listDocuments).mockRejectedValueOnce(new NostromoClientError('nope', { kind: 'auth', status: 401 }))
    await expect(pullNostromo()).resolves.toEqual({ kind: 'skipped', reason: 'auth' })
    expect(getNostromoSyncStatus()).toBe('auth-required')
  })

  it('shares one in-flight run between concurrent callers', async () => {
    listRemote([makeDocument('clubs', [{ id: 'c1' }], 1)])

    const [first, second] = await Promise.all([pullNostromo(), pullNostromo()])

    expect(first).toBe(second)
    expect(listDocuments).toHaveBeenCalledTimes(1)
  })

  it('aborts when a list unit is edited between the drain check and the commit', async () => {
    listRemote([makeDocument('clubs', [{ id: 'remote' }], 1)])
    vi.mocked(listDocuments).mockImplementationOnce(() => {
      hydrateClubs([{ id: 'mine' }] as never)
      markUnitDirty('clubs')
      return Promise.resolve({
        items: [makeDocument('clubs', [{ id: 'remote' }], 1)],
        page: 1,
        perPage: 500,
        totalItems: 1,
      })
    })

    await expect(pullNostromo()).resolves.toEqual({ kind: 'skipped', reason: 'conflict-pending' })

    expect(getRawClubs().map((club) => club.id)).toEqual(['mine'])
    expect(getDirtyUnits()).toContain('clubs')
    expect(getBaseline('clubs')).toBeUndefined()
  })

  it('aborts when the titles are edited between the drain check and the commit', async () => {
    vi.mocked(listDocuments).mockImplementationOnce(() => {
      updateTitle('teamName', 'Mine')
      return Promise.resolve({
        items: [makeDocument('trombiTitles', [{ teamName: 'Remote' }], 1)],
        page: 1,
        perPage: 500,
        totalItems: 1,
      })
    })

    await expect(pullNostromo()).resolves.toEqual({ kind: 'skipped', reason: 'conflict-pending' })

    expect(getTitles().teamName).toBe('Mine')
    expect(getDirtyUnits()).toContain('trombiTitles')
  })

  it('aborts when a clubs baseline moves during a clean photo deletion, applies nothing stale, and marks nothing', async () => {
    // Scenario with no missing collection, so the dirty re-check cannot fire first: only the baseline check
    // can stop the stale clubs plan. The deletePhoto await moves the clubs baseline. Without hasBaselineMoved,
    // the stale clubs unit would be committed and this test would fail.
    const PHOTO_UNIT = photoUnitName('p1')
    setBaselines([
      { baseline: { docId: collectionDocId('clubs'), savedAt: 1, version: 1 }, unit: 'clubs' },
      { baseline: { docId: photoDocId('p1'), savedAt: 1, version: 2 }, unit: PHOTO_UNIT },
    ])
    hydrateClubs([{ id: 'mine' }] as never)
    listRemote([makeDocument('clubs', [{ id: 'remote' }], 3)])
    vi.mocked(deletePhoto).mockImplementationOnce(() => {
      setBaselines([{ baseline: { docId: collectionDocId('clubs'), savedAt: 2, version: 2 }, unit: 'clubs' }])
      return Promise.resolve()
    })

    await expect(pullNostromo()).resolves.toEqual({ kind: 'skipped', reason: 'conflict-pending' })

    expect(getRawClubs().map((club) => club.id)).toEqual(['mine'])
    expect(getBaseline('clubs')?.version).toBe(2)
    expect(getDirtyUnits()).toEqual([])
  })

  it('applies a clean deletion without aborting: the rule 3 mark created by the pull is not an edit', async () => {
    // A clean players baseline is missing on both listings, and clubs is to apply. The rule 3 dirty mark
    // of players is created during the pull, after the re-checks. Before the fix, it aborted the pull.
    setBaselines([{ baseline: { docId: collectionDocId('players'), savedAt: 1, version: 1 }, unit: 'players' }])
    listRemote([makeDocument('clubs', [{ id: 'c1' }], 1)])

    await expect(pullNostromo()).resolves.toEqual({ kind: 'applied', units: ['clubs'] })

    expect(getRawClubs().map((club) => club.id)).toEqual(['c1'])
    expect(getBaseline('players')).toBeUndefined()
    expect(getDirtyUnits()).toEqual(['players'])
  })

  describe('deletion propagation', () => {
    const PHOTO_UNIT = photoUnitName('p1')

    function baselinePhoto(): void {
      setBaselines([{ baseline: { docId: photoDocId('p1'), savedAt: 1, version: 2 }, unit: PHOTO_UNIT }])
    }

    it('keeps local data of a clean collection whose remote document is gone, and clears its baseline', async () => {
      hydrateClubs([{ id: 'mine' }] as never)
      setBaselines([{ baseline: { docId: collectionDocId('clubs'), savedAt: 1, version: 2 }, unit: 'clubs' }])
      listRemote([])

      await expect(pullNostromo()).resolves.toEqual({ kind: 'up-to-date' })

      expect(getRawClubs().map((club) => club.id)).toEqual(['mine'])
      expect(getBaseline('clubs')).toBeUndefined()
      // Rule 3: the local copy is the only one left, so the next push recreates the document.
      expect(getDirtyUnits()).toEqual(['clubs'])
      expect(getNostromoLog().map((entry) => entry.message)).toContain(
        "Le document « clubs » n'existe plus sur le serveur : les données locales sont conservées."
      )
    })

    it('re-lists exactly once before acting on a missing document', async () => {
      baselinePhoto()
      listRemote([])

      await pullNostromo()

      expect(listDocuments).toHaveBeenCalledTimes(2)
    })

    it('does not act when the re-list brings the document back', async () => {
      setBaselines([{ baseline: { docId: collectionDocId('clubs'), savedAt: 1, version: 2 }, unit: 'clubs' }])
      vi.mocked(listDocuments)
        .mockResolvedValueOnce({ items: [], page: 1, perPage: 500, totalItems: 0 })
        .mockResolvedValueOnce({
          items: [makeDocument('clubs', [{ id: 'c1' }], 2)],
          page: 1,
          perPage: 500,
          totalItems: 1,
        })

      await pullNostromo()

      expect(getBaseline('clubs')?.version).toBe(2)
    })

    it('deletes a clean local photo whose remote document is gone and clears the player flag', async () => {
      hydratePlayers([{ hasPhoto: true, id: 'p1' }] as never)
      baselinePhoto()
      listRemote([])

      await expect(pullNostromo()).resolves.toEqual({ kind: 'applied', units: [PHOTO_UNIT] })

      expect(deletePhoto).toHaveBeenCalledWith('p1')
      expect(getRawPlayers()[0]?.hasPhoto).toBe(false)
      expect(getBaseline(PHOTO_UNIT)).toBeUndefined()
      expect(getDirtyUnits()).toEqual([])
    })

    it('downloads a remote-only photo, stores it and keeps hasPhoto true', async () => {
      hydratePlayers([{ hasPhoto: false, id: 'p1' }] as never)
      const blob = new Blob(['img'], { type: 'image/webp' })
      const photoDocument: NostromoDocument = {
        file: 'p1.webp',
        fileSize: blob.size,
        id: photoDocId('p1'),
        owner: 'user-1',
        payload: { playerId: 'p1', schema: 1, type: 'photo' },
        updated: '2026-10-24 10:00:00.000Z',
        version: 4,
      }
      listRemote([photoDocument])
      vi.mocked(getDocument).mockResolvedValue(photoDocument)
      vi.mocked(downloadFile).mockResolvedValue(blob)
      // The photo store marks the unit on write, exactly like the real store.
      vi.mocked(storePhoto).mockImplementationOnce(() => {
        markUnitDirty(PHOTO_UNIT)
        return Promise.resolve()
      })
      // After the write the local store holds the photo, so the flag is derived from it.
      vi.mocked(getAllPhotoEntries).mockResolvedValueOnce([{ playerId: 'p1' }] as never)

      const outcome = await pullNostromo()
      expect(outcome).toEqual({ kind: 'applied', units: [PHOTO_UNIT] })

      expect(storePhoto).toHaveBeenCalledWith('p1', blob)
      expect(getBaseline(PHOTO_UNIT)?.version).toBe(4)
      expect(getDirtyUnits()).toEqual([])
      expect(getRawPlayers()[0]?.hasPhoto).toBe(true)
    })

    it('never deletes a photo that becomes dirty during the re-list, and keeps its baseline', async () => {
      // The photo is clean when the pull starts and when its first listing is read, so the global
      // dirty checks (prepareSession, the commit re-check) do not fire. The mark lands during the
      // second listing, right before removeLocalPhotos: only its per-unit guard can stop the delete.
      baselinePhoto()
      vi.mocked(listDocuments)
        .mockResolvedValueOnce({ items: [], page: 1, perPage: 500, totalItems: 0 })
        .mockImplementationOnce(() => {
          markUnitDirty(PHOTO_UNIT)
          return Promise.resolve({ items: [], page: 1, perPage: 500, totalItems: 0 })
        })

      await expect(pullNostromo()).resolves.toEqual({ kind: 'up-to-date' })

      expect(listDocuments).toHaveBeenCalledTimes(2)
      expect(deletePhoto).not.toHaveBeenCalled()
      expect(getBaseline(PHOTO_UNIT)?.version).toBe(2)
      expect(getDirtyUnits()).toEqual([PHOTO_UNIT])
    })
  })
})
