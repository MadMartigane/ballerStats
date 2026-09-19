import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deletePhoto,
  deletePhotoAndFlag,
  getAllPhotoEntries,
  getPhoto,
  setPhotoAndFlag,
  storePhoto,
} from '../photo-store/photo-store'
import type { PhotoEntry } from '../photo-store/photo-store.d'
import type { PlayerRawData } from '../player/player.d'
import { getRawClubs, replaceAllClubs } from '../stores/clubs-store'
import { getRawContacts } from '../stores/contacts-store'
import { getRawMatchs } from '../stores/matchs-store'
import { getPlayerById, getRawPlayers, replaceAllPlayers, updatePlayer } from '../stores/players-store'
import { getRawTeams, replaceAllTeams } from '../stores/teams-store'
import { persistTitles, titles } from '../trombi-titles-store'
import { NostromoClientError, photoDocId } from './client'
import type { NostromoDocument } from './client.d'
import { cancelDirtyDebounce } from './dirty-marks'
import { getConfig } from './nostromo-config-store'
import type { NostromoBaseline, NostromoUnitName } from './nostromo-sync-store.d'
import { collectionDocId, NOSTROMO_PAYLOAD_SCHEMA } from './push-engine'
import { applyNostromoOverwrite, applyNostromoRestore, confirmNostromoRestore, planNostromoRestore } from './restore'
import type { NostromoCollectionPlanUnit, NostromoPhotoPlanUnit, NostromoRestorePlan } from './restore.d'
import { NOSTROMO_LOCAL_PHOTO_READ_TIMEOUT_MS } from './restore-plan'

const BASE_URL = 'https://nostromo.test'
const AUTH_TOKEN = 'auth-token-raw'
const USER_ID = 'user-owner-0001'
const FILE_TOKEN = 'file-token-short-lived'
const PLAYERS_DOC_ID = 'pl0000000000001'
const TEAMS_DOC_ID = 'tm0000000000001'
const PHOTO_FILE = 'player-1.webp'
const PLAYER_ID = 'player-1'
const PHOTO_UNIT = `photo:${PLAYER_ID}`
const PAGE_SIZE = 500
const NOW = 1_700_000_000_000
const PLAYERS_PREFIX = /^players: /

/**
 * In-memory stand-in for the sync store. The store is a module singleton with
 * persisted state, so the tests drive it through this plain state object, which
 * the mocked module reads and writes exactly like the real one does.
 */
const syncState = vi.hoisted(() => ({
  baselines: {} as Record<string, { conflicted?: boolean; docId: string; savedAt: number; version: number }>,
  log: [] as { level: string; message: string }[],
  outbox: [] as string[],
  status: 'off',
}))

/** Client calls are mocked, but `NostromoClientError` and `photoDocId` stay real. */
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
  clearBaseline: vi.fn((unit: string) => {
    delete syncState.baselines[unit]
  }),
  getAllBaselines: vi.fn(() => ({ ...syncState.baselines })),
  getBaseline: vi.fn((unit: string) => syncState.baselines[unit]),
  getDirtyUnits: vi.fn(() => [...syncState.outbox]),
  isUnitDirty: vi.fn((unit: string) => syncState.outbox.includes(unit)),
  pushNostromoLog: vi.fn((level: string, message: string) => {
    syncState.log.push({ level, message })
  }),
  setBaseline: vi.fn((unit: string, baseline: { docId: string; savedAt: number; version: number }) => {
    syncState.baselines[unit] = { ...baseline }
  }),
  setBaselines: vi.fn((updates: { baseline: { docId: string; savedAt: number; version: number }; unit: string }[]) => {
    for (const { baseline, unit } of updates) {
      syncState.baselines[unit] = { ...baseline }
    }
  }),
  setDirtyUnits: vi.fn((units: string[]) => {
    syncState.outbox = units.filter((unit, index) => unit !== '' && units.indexOf(unit) === index)
  }),
  setNostromoSyncStatus: vi.fn((status: string) => {
    syncState.status = status
  }),
}))

/** The debounce is spied so a test can prove the restore disarms a pending flush. */
vi.mock('./dirty-marks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dirty-marks')>()
  return { ...actual, cancelDirtyDebounce: vi.fn() }
})

vi.mock('../photo-store/photo-store', () => ({
  deletePhoto: vi.fn(() => Promise.resolve()),
  deletePhotoAndFlag: vi.fn((player: { hasPhoto: boolean }) => {
    player.hasPhoto = false
    return Promise.resolve()
  }),
  getAllPhotoEntries: vi.fn(() => Promise.resolve([])),
  getPhoto: vi.fn(() => Promise.resolve(undefined)),
  PHOTO_FILE_EXTENSION: '.webp',
  PHOTO_MIME_TYPE: 'image/webp',
  setPhotoAndFlag: vi.fn((player: { hasPhoto: boolean }) => {
    player.hasPhoto = true
    return Promise.resolve()
  }),
  storePhoto: vi.fn(() => Promise.resolve()),
}))

vi.mock('../stores/clubs-store', () => ({ getRawClubs: vi.fn(() => []), replaceAllClubs: vi.fn() }))
vi.mock('../stores/contacts-store', () => ({ getRawContacts: vi.fn(() => []), replaceAllContacts: vi.fn() }))
vi.mock('../stores/matchs-store', () => ({ getRawMatchs: vi.fn(() => []), replaceAllMatchs: vi.fn() }))
vi.mock('../stores/players-store', () => ({
  getPlayerById: vi.fn(() => null),
  getRawPlayers: vi.fn(() => []),
  replaceAllPlayers: vi.fn(),
  updatePlayer: vi.fn(),
}))
vi.mock('../stores/teams-store', () => ({ getRawTeams: vi.fn(() => []), replaceAllTeams: vi.fn() }))
vi.mock('../trombi-titles-store', () => {
  const titlesState = { teamName: '' }
  return {
    DEFAULT_TITLES: { teamName: '' },
    getTitles: () => ({ teamName: titlesState.teamName }),
    persistTitles: vi.fn(() => Promise.resolve()),
    titles: titlesState,
    updateTitle: vi.fn(),
  }
})

const { createDocument, downloadFile, getDocument, getFileToken, listDocuments, updateDocument, uploadDocumentFile } =
  await import('./client')

function makeConfig(): { baseUrl: string; email: string; token: string; userId: string } {
  return { baseUrl: BASE_URL, email: 'coach@example.com', token: AUTH_TOKEN, userId: USER_ID }
}

function makeBlob(): Blob {
  return new Blob(['photo-bytes'], { type: 'image/webp' })
}

function collectionPayload(name: NostromoUnitName, items: unknown[]): Record<string, unknown> {
  return { items, name, schema: NOSTROMO_PAYLOAD_SCHEMA, type: 'collection' }
}

function photoPayload(playerId: string): Record<string, unknown> {
  return { playerId, schema: NOSTROMO_PAYLOAD_SCHEMA, type: 'photo' }
}

function makeDocument(overrides: Partial<NostromoDocument> = {}): NostromoDocument {
  return {
    id: PLAYERS_DOC_ID,
    owner: USER_ID,
    payload: collectionPayload('players', []),
    updated: '2026-09-15 10:00:00.000Z',
    version: 1,
    ...overrides,
  }
}

function collectionDocument(unit: NostromoUnitName, version: number, items: unknown[], id = PLAYERS_DOC_ID) {
  return makeDocument({ id, payload: collectionPayload(unit, items), version })
}

function photoDocument(version: number, playerId = PLAYER_ID, file = PHOTO_FILE): NostromoDocument {
  return makeDocument({ file, id: photoDocId(playerId), payload: photoPayload(playerId), version })
}

function makeBaseline(overrides: Partial<NostromoBaseline> = {}): NostromoBaseline {
  return { docId: PLAYERS_DOC_ID, savedAt: NOW, version: 1, ...overrides }
}

/** Local player of a photo unit: the flag-aware helpers are driven through it. */
function makePlayerRaw(overrides: Partial<PlayerRawData> = {}): PlayerRawData {
  return { firstName: 'Nina', hasPhoto: false, id: PLAYER_ID, ...overrides }
}

function notFound(id: string): NostromoClientError {
  return new NostromoClientError(`GET /api/collections/documents/records/${id} failed (404): not found.`, {
    kind: 'notfound',
    status: 404,
  })
}

function conflict(id: string): NostromoClientError {
  return new NostromoClientError(`PATCH /api/collections/documents/records/${id} failed (409): version mismatch.`, {
    kind: 'conflict',
    status: 409,
  })
}

function authRefusal(): NostromoClientError {
  return new NostromoClientError('GET /api/collections/documents/records failed (401): unauthorized.', {
    kind: 'auth',
    status: 401,
  })
}

/** Serves a listing of one page holding every given document. */
function serveListing(documents: NostromoDocument[]): void {
  vi.mocked(listDocuments).mockResolvedValue({
    items: documents,
    page: 1,
    perPage: PAGE_SIZE,
    totalItems: documents.length,
  })
}

/** Serves a per-document read for everything `serveListing` returned. */
function serveDocuments(documents: NostromoDocument[]): void {
  const byId = new Map(documents.map((document) => [document.id, document]))
  vi.mocked(getDocument).mockImplementation((_baseUrl, _token, id) => {
    const document = byId.get(id)
    return document ? Promise.resolve(document) : Promise.reject(notFound(id))
  })
}

function serveLocalPhotos(playerIds: string[]): void {
  vi.mocked(getAllPhotoEntries).mockResolvedValue(playerIds.map((playerId) => ({ blob: makeBlob(), playerId })))
}

function collectionUnit(plan: NostromoRestorePlan, unit: NostromoUnitName): NostromoCollectionPlanUnit {
  const found = plan.collectionUnits.find((candidate) => candidate.unit === unit)
  if (!found) {
    throw new Error(`The plan holds no ${unit} unit.`)
  }
  return found
}

function photoUnit(plan: NostromoRestorePlan, playerId = PLAYER_ID): NostromoPhotoPlanUnit {
  const found = plan.photoUnits.find((candidate) => candidate.playerId === playerId)
  if (!found) {
    throw new Error(`The plan holds no photo unit for ${playerId}.`)
  }
  return found
}

function logMessages(): string[] {
  return syncState.log.map((entry) => entry.message)
}

beforeEach(() => {
  vi.clearAllMocks()
  syncState.baselines = {}
  syncState.log = []
  syncState.outbox = []
  syncState.status = 'off'

  vi.mocked(getConfig).mockReturnValue(makeConfig())
  serveListing([])
  serveDocuments([])
  vi.mocked(getFileToken).mockResolvedValue(FILE_TOKEN)
  vi.mocked(downloadFile).mockResolvedValue(makeBlob())
  vi.mocked(uploadDocumentFile).mockImplementation((_baseUrl, _token, id) =>
    Promise.resolve(makeDocument({ id, version: 2 }))
  )
  serveLocalPhotos([])
  vi.mocked(getRawPlayers).mockReturnValue([])
  vi.mocked(getRawTeams).mockReturnValue([])
  vi.mocked(getRawClubs).mockReturnValue([])
  vi.mocked(getRawMatchs).mockReturnValue([])
  vi.mocked(getRawContacts).mockReturnValue([])
  vi.mocked(getPlayerById).mockReturnValue(null)
  titles.teamName = ''
})

describe('planNostromoRestore', () => {
  it('groups the remote documents into collection and photo units', async () => {
    const documents = [
      collectionDocument('players', 3, [{ id: 'p1' }]),
      photoDocument(4),
      makeDocument({ id: 'zz0000000000001', payload: { anything: true } }),
      makeDocument({ id: 'zz0000000000002', payload: undefined }),
    ]
    serveListing(documents)

    const plan = await planNostromoRestore()
    const players = collectionUnit(plan, 'players')

    expect(plan.remoteDocumentCount).toBe(4)
    expect(plan.remotePhotoCount).toBe(1)
    expect(players.remote).toEqual({
      docId: PLAYERS_DOC_ID,
      itemCount: 1,
      updated: '2026-09-15 10:00:00.000Z',
      version: 3,
    })
    expect(players.remotePayloadValid).toBe(true)
    expect(photoUnit(plan).remote?.docId).toBe(photoDocId(PLAYER_ID))
    expect(photoUnit(plan).remote?.file).toBe(PHOTO_FILE)
    expect(plan.photoUnits).toHaveLength(1)
    expect(plan.warnings).toHaveLength(2)
    expect(plan.warnings.every((warning) => warning.includes('ignoré'))).toBe(true)
    expect(plan.requiresConfirmation).toBe(false)
  })

  it('reads every page of the listing with the maximum page size', async () => {
    const firstPage = Array.from({ length: PAGE_SIZE }, (_unused, index) =>
      photoDocument(1, `player-${index}`, PHOTO_FILE)
    )
    const secondPage = [photoDocument(1, 'player-last', PHOTO_FILE)]
    vi.mocked(listDocuments).mockImplementation((_baseUrl, _token, opts) =>
      Promise.resolve(
        opts?.page === 1
          ? { items: firstPage, page: 1, perPage: PAGE_SIZE, totalItems: PAGE_SIZE + 1 }
          : { items: secondPage, page: 2, perPage: PAGE_SIZE, totalItems: PAGE_SIZE + 1 }
      )
    )

    const plan = await planNostromoRestore()

    expect(listDocuments).toHaveBeenCalledTimes(2)
    expect(listDocuments).toHaveBeenNthCalledWith(1, BASE_URL, AUTH_TOKEN, { page: 1, perPage: PAGE_SIZE })
    expect(listDocuments).toHaveBeenNthCalledWith(2, BASE_URL, AUTH_TOKEN, { page: 2, perPage: PAGE_SIZE })
    expect(plan.remoteDocumentCount).toBe(PAGE_SIZE + 1)
    expect(plan.remotePhotoCount).toBe(PAGE_SIZE + 1)
  })

  it('flags a dirty local unit and requires a confirmation', async () => {
    serveListing([collectionDocument('players', 3, [{ id: 'p1' }])])
    syncState.outbox = ['players']

    const plan = await planNostromoRestore()
    const players = collectionUnit(plan, 'players')

    expect(players.localDirty).toBe(true)
    expect(players.requiresConfirmation).toBe(true)
    expect(players.warnings.join(' ')).toContain("en attente d'envoi")
    expect(plan.requiresConfirmation).toBe(true)
    expect(plan.warnings[0]).toMatch(PLAYERS_PREFIX)
  })

  it('flags a remote version ahead of the baseline and requires a confirmation', async () => {
    serveListing([collectionDocument('players', 5, [{ id: 'p1' }])])
    syncState.baselines = { players: makeBaseline({ version: 4 }) }

    const plan = await planNostromoRestore()
    const players = collectionUnit(plan, 'players')

    expect(players.localBaseline?.version).toBe(4)
    expect(players.requiresConfirmation).toBe(true)
    expect(players.warnings.join(' ')).toContain('plus récente que la référence locale')
  })

  it('flags a missing baseline while the local collection holds items', async () => {
    serveListing([collectionDocument('players', 1, [{ id: 'p1' }])])
    vi.mocked(getRawPlayers).mockReturnValue([{ id: 'local-1' }, { id: 'local-2' }])

    const plan = await planNostromoRestore()
    const players = collectionUnit(plan, 'players')

    expect(players.localCount).toBe(2)
    expect(players.localBaseline).toBeUndefined()
    expect(players.requiresConfirmation).toBe(true)
    expect(players.warnings.join(' ')).toContain('aucune référence locale')
  })

  it('leaves an in-sync unit without a warning or a confirmation', async () => {
    serveListing([collectionDocument('players', 3, [{ id: 'p1' }]), collectionDocument('teams', 2, [], TEAMS_DOC_ID)])
    syncState.baselines = {
      players: makeBaseline({ version: 3 }),
      teams: makeBaseline({ docId: TEAMS_DOC_ID, version: 2 }),
    }

    const plan = await planNostromoRestore()

    expect(collectionUnit(plan, 'players').warnings).toEqual([])
    expect(collectionUnit(plan, 'teams').warnings).toEqual([])
    expect(plan.requiresConfirmation).toBe(false)
  })

  it('flags the local photos the server does not know about', async () => {
    serveListing([photoDocument(2)])
    serveLocalPhotos([PLAYER_ID, 'player-orphan'])
    syncState.baselines = { [PHOTO_UNIT]: makeBaseline({ docId: photoDocId(PLAYER_ID), version: 1 }) }

    const plan = await planNostromoRestore()
    const known = photoUnit(plan)
    const orphan = photoUnit(plan, 'player-orphan')

    expect(known.deletionRequired).toBe(false)
    expect(known.upToDate).toBe(false)
    expect(known.requiresConfirmation).toBe(true)
    expect(known.warnings.join(' ')).toContain('écrase la photo locale')

    expect(orphan.deletionRequired).toBe(true)
    expect(orphan.remote).toBeUndefined()
    expect(orphan.requiresConfirmation).toBe(true)
    expect(orphan.warnings.join(' ')).toContain('la supprime localement')
    expect(plan.localPhotoCount).toBe(2)
    expect(plan.requiresConfirmation).toBe(true)
  })

  it('marks an up-to-date photo as done and warns when the remote carries no file', async () => {
    serveListing([photoDocument(2), makeDocument({ id: photoDocId('player-2'), payload: photoPayload('player-2') })])
    serveLocalPhotos([PLAYER_ID, 'player-2'])
    syncState.baselines = {
      [PHOTO_UNIT]: makeBaseline({ docId: photoDocId(PLAYER_ID), version: 2 }),
      'photo:player-2': makeBaseline({ docId: photoDocId('player-2'), version: 1 }),
    }

    const plan = await planNostromoRestore()
    const inSync = photoUnit(plan)
    const fileless = photoUnit(plan, 'player-2')

    expect(inSync.upToDate).toBe(true)
    expect(inSync.warnings).toEqual([])
    expect(inSync.requiresConfirmation).toBe(false)

    expect(fileless.remote?.file).toBeUndefined()
    expect(fileless.upToDate).toBe(false)
    expect(fileless.warnings.join(' ')).toContain('ne porte aucun fichier')
  })

  it('keeps the newest document when several claim the same unit, and warns', async () => {
    serveListing([
      collectionDocument('players', 2, [{ id: 'p1' }], 'pl0000000000001'),
      collectionDocument('players', 7, [{ id: 'p2' }], 'pl0000000000002'),
    ])

    const plan = await planNostromoRestore()

    expect(collectionUnit(plan, 'players').remote?.version).toBe(7)
    expect(plan.warnings.join(' ')).toContain('plusieurs documents distants revendiquent')
  })

  it('warns when a baseline survives a document the server no longer holds', async () => {
    serveListing([])
    syncState.baselines = { players: makeBaseline() }

    const plan = await planNostromoRestore()
    const players = collectionUnit(plan, 'players')

    expect(players.remote).toBeUndefined()
    expect(players.remotePayloadValid).toBe(false)
    expect(players.warnings.join(' ')).toContain('ne détient plus de document')
  })

  it('degrades the local photo listing instead of hanging when the store never answers', async () => {
    vi.useFakeTimers()
    try {
      serveListing([photoDocument(2)])
      vi.mocked(getAllPhotoEntries).mockImplementation(() => new Promise<PhotoEntry[]>(() => undefined))

      const pending = planNostromoRestore()
      await vi.advanceTimersByTimeAsync(NOSTROMO_LOCAL_PHOTO_READ_TIMEOUT_MS)

      const plan = await pending

      // The remote photo is still planned: only the local photos are ignored.
      expect(photoUnit(plan).remote?.version).toBe(2)
      expect(photoUnit(plan).localPhotoExists).toBe(false)
      expect(plan.localPhotoCount).toBe(0)
      expect(plan.warnings.join(' ')).toContain("n'a pas répondu en")
      expect(logMessages().join(' ')).toContain("n'a pas répondu en")
    } finally {
      vi.useRealTimers()
    }
  })

  it('refuses to plan without a configuration', async () => {
    vi.mocked(getConfig).mockReturnValue(undefined)

    await expect(planNostromoRestore()).rejects.toMatchObject({ kind: 'auth' })
    expect(listDocuments).not.toHaveBeenCalled()
  })

  it('sets auth-required and rethrows when the listing is refused', async () => {
    vi.mocked(listDocuments).mockRejectedValue(authRefusal())

    await expect(planNostromoRestore()).rejects.toMatchObject({ kind: 'auth' })
    expect(syncState.status).toBe('auth-required')
    expect(logMessages().join(' ')).toContain('401')
  })
})

describe('applyNostromoRestore', () => {
  it('replaces the collections, pulls the photos and re-baselines every unit', async () => {
    const documents = [
      collectionDocument('players', 3, [{ id: 'p1' }]),
      collectionDocument('teams', 2, [{ id: 't1' }], TEAMS_DOC_ID),
      photoDocument(4),
    ]
    serveListing(documents)
    serveDocuments(documents)
    serveLocalPhotos([PLAYER_ID])
    syncState.outbox = ['players', 'clubs']

    const plan = await planNostromoRestore()
    const result = await applyNostromoRestore(plan)

    expect(replaceAllPlayers).toHaveBeenCalledWith([{ id: 'p1' }])
    expect(replaceAllTeams).toHaveBeenCalledWith([{ id: 't1' }])
    expect(replaceAllClubs).not.toHaveBeenCalled()
    expect(getDocument).toHaveBeenCalledTimes(3)

    expect(storePhoto).toHaveBeenCalledWith(PLAYER_ID, expect.any(Blob))
    expect(getFileToken).toHaveBeenCalledTimes(1)
    expect(downloadFile).toHaveBeenCalledWith(BASE_URL, FILE_TOKEN, photoDocId(PLAYER_ID), PHOTO_FILE)

    expect(syncState.baselines.players).toMatchObject({ docId: PLAYERS_DOC_ID, version: 3 })
    expect(syncState.baselines.teams).toMatchObject({ docId: TEAMS_DOC_ID, version: 2 })
    expect(syncState.baselines[PHOTO_UNIT]).toMatchObject({ docId: photoDocId(PLAYER_ID), version: 4 })
    expect(syncState.baselines.players?.savedAt).toBeGreaterThan(0)

    expect(result.appliedUnits).toContain('players')
    expect(result.appliedUnits).toContain('teams')
    expect(result.appliedUnits).toContain(PHOTO_UNIT)
    expect(result.failedUnits).toEqual([])
    expect(syncState.status).toBe('saved')
    expect(logMessages().join(' | ')).toContain(`photo du joueur ${PLAYER_ID} reprise`)
  })

  it('re-baselines a pulled photo with the version re-read at apply time', async () => {
    const listed = photoDocument(4)
    serveListing([listed])
    serveLocalPhotos([PLAYER_ID])
    // The plan froze version 4; the document moved on before the user
    // confirmed. The apply must re-read the document and keep the fresh version
    // as the baseline, exactly like the collection path does.
    vi.mocked(getDocument).mockResolvedValue({ ...listed, version: 5 })

    const plan = await planNostromoRestore()
    expect(photoUnit(plan).remote?.version).toBe(4)

    const result = await applyNostromoRestore(plan)

    expect(getDocument).toHaveBeenCalledWith(BASE_URL, AUTH_TOKEN, photoDocId(PLAYER_ID))
    expect(downloadFile).toHaveBeenCalledTimes(1)
    expect(syncState.baselines[PHOTO_UNIT]).toMatchObject({ docId: photoDocId(PLAYER_ID), version: 5 })
    expect(result.appliedUnits).toEqual([PHOTO_UNIT])
    expect(result.failedUnits).toEqual([])
  })

  it('fails a photo unit without writing a baseline when the document vanished after the plan', async () => {
    const listed = photoDocument(4)
    serveListing([listed])
    serveLocalPhotos([PLAYER_ID])
    vi.mocked(getDocument).mockRejectedValue(notFound(photoDocId(PLAYER_ID)))

    const plan = await planNostromoRestore()
    const result = await applyNostromoRestore(plan)

    expect(downloadFile).not.toHaveBeenCalled()
    expect(syncState.baselines[PHOTO_UNIT]).toBeUndefined()
    expect(result.failedUnits).toEqual([PHOTO_UNIT])
    expect(syncState.status).toBe('error')
    expect(logMessages().join(' ')).toContain('a échoué')
  })

  it('mints one file token per downloaded photo', async () => {
    const documents = [photoDocument(1, 'player-1'), photoDocument(1, 'player-2', 'player-2.webp')]
    serveListing(documents)
    serveDocuments(documents)
    vi.mocked(getFileToken).mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2')

    const plan = await planNostromoRestore()
    await applyNostromoRestore(plan)

    expect(getFileToken).toHaveBeenCalledTimes(2)
    expect(downloadFile).toHaveBeenNthCalledWith(1, BASE_URL, 'token-1', photoDocId('player-1'), PHOTO_FILE)
    expect(downloadFile).toHaveBeenNthCalledWith(2, BASE_URL, 'token-2', photoDocId('player-2'), 'player-2.webp')
  })

  it('skips and logs a unit whose remote payload fails the runtime guard', async () => {
    const broken = makeDocument({ payload: { items: 'not-an-array', name: 'players', schema: 1, type: 'collection' } })
    const stale = makeDocument({
      id: TEAMS_DOC_ID,
      payload: { items: [], name: 'teams', schema: NOSTROMO_PAYLOAD_SCHEMA + 1, type: 'collection' },
    })
    serveListing([broken, stale])
    serveDocuments([broken, stale])

    const plan = await planNostromoRestore()
    const result = await applyNostromoRestore(plan)

    expect(replaceAllPlayers).not.toHaveBeenCalled()
    expect(replaceAllTeams).not.toHaveBeenCalled()
    expect(result.skippedUnits).toContain('players')
    expect(result.skippedUnits).toContain('teams')
    expect(result.failedUnits).toEqual([])
    expect(logMessages().filter((message) => message.includes('inutilisable'))).toHaveLength(2)
  })

  it('keeps going when one unit fails and reports it', async () => {
    const documents = [
      collectionDocument('players', 3, [{ id: 'p1' }]),
      collectionDocument('teams', 1, [], TEAMS_DOC_ID),
    ]
    serveListing(documents)
    vi.mocked(getDocument).mockImplementation((_baseUrl, _token, id) =>
      id === TEAMS_DOC_ID ? Promise.reject(notFound(TEAMS_DOC_ID)) : Promise.resolve(documents[0])
    )

    const plan = await planNostromoRestore()
    const result = await applyNostromoRestore(plan)

    expect(replaceAllPlayers).toHaveBeenCalledTimes(1)
    expect(result.appliedUnits).toEqual(['players'])
    expect(result.failedUnits).toEqual(['teams'])
    expect(syncState.baselines.teams).toBeUndefined()
    expect(syncState.status).toBe('error')
  })

  it('aborts on a refused session after the units it already read', async () => {
    const documents = [
      collectionDocument('players', 3, [{ id: 'p1' }]),
      collectionDocument('teams', 1, [], TEAMS_DOC_ID),
    ]
    serveListing(documents)
    vi.mocked(getDocument).mockImplementation((_baseUrl, _token, id) =>
      id === TEAMS_DOC_ID ? Promise.reject(authRefusal()) : Promise.resolve(documents[0])
    )

    const plan = await planNostromoRestore()

    await expect(applyNostromoRestore(plan)).rejects.toMatchObject({ kind: 'auth' })
    expect(syncState.status).toBe('auth-required')
    expect(replaceAllPlayers).not.toHaveBeenCalled()
    expect(replaceAllTeams).not.toHaveBeenCalled()
  })

  it('settles the collections it already applied when the photo phase is refused', async () => {
    const documents = [collectionDocument('players', 3, [{ id: 'p1' }]), photoDocument(4)]
    serveListing(documents)
    serveDocuments(documents)
    serveLocalPhotos([])
    syncState.outbox = ['players']
    vi.mocked(getFileToken).mockRejectedValue(authRefusal())

    const plan = await planNostromoRestore()

    await expect(applyNostromoRestore(plan)).rejects.toMatchObject({ kind: 'auth' })

    expect(replaceAllPlayers).toHaveBeenCalledWith([{ id: 'p1' }])
    // The players collection was written before the refusal: its baseline is
    // settled and it leaves the outbox, so the next push cannot answer 409 on it.
    expect(syncState.baselines.players).toMatchObject({ docId: PLAYERS_DOC_ID, version: 3 })
    expect(syncState.outbox).toEqual([])
    expect(syncState.status).toBe('auth-required')
  })

  it('flags the player of a pulled photo through the canonical photo helpers', async () => {
    const documents = [photoDocument(1)]
    serveListing(documents)
    serveDocuments(documents)
    vi.mocked(getPlayerById).mockReturnValue(makePlayerRaw())

    const plan = await planNostromoRestore()
    await applyNostromoRestore(plan)

    expect(setPhotoAndFlag).toHaveBeenCalledWith(expect.objectContaining({ id: PLAYER_ID }), expect.any(Blob))
    expect(updatePlayer).toHaveBeenCalledWith(PLAYER_ID, expect.objectContaining({ hasPhoto: true, id: PLAYER_ID }))
    expect(storePhoto).not.toHaveBeenCalled()
    expect(syncState.baselines[PHOTO_UNIT]).toMatchObject({ docId: photoDocId(PLAYER_ID), version: 1 })
  })

  it('deletes the local photo the server does not know about', async () => {
    serveListing([])
    serveLocalPhotos([PLAYER_ID])

    const plan = await planNostromoRestore()
    const result = await applyNostromoRestore(plan)

    expect(deletePhoto).toHaveBeenCalledWith(PLAYER_ID)
    expect(storePhoto).not.toHaveBeenCalled()
    expect(result.deletedPhotoUnits).toEqual([PHOTO_UNIT])
    expect(result.appliedUnits).toEqual([])
    expect(logMessages().join(' ')).toContain('la photo locale du joueur')
  })

  it('clears the photo flag of the player when the local copy is deleted', async () => {
    serveListing([])
    serveLocalPhotos([PLAYER_ID])
    vi.mocked(getPlayerById).mockReturnValue(makePlayerRaw({ hasPhoto: true }))

    const plan = await planNostromoRestore()
    const result = await applyNostromoRestore(plan)

    expect(deletePhotoAndFlag).toHaveBeenCalledWith(expect.objectContaining({ id: PLAYER_ID }))
    expect(updatePlayer).toHaveBeenCalledWith(PLAYER_ID, expect.objectContaining({ hasPhoto: false, id: PLAYER_ID }))
    expect(deletePhoto).not.toHaveBeenCalled()
    expect(result.deletedPhotoUnits).toEqual([PHOTO_UNIT])
    expect(syncState.baselines[PHOTO_UNIT]).toBeUndefined()
  })

  it('removes the restored units from the outbox and disarms the debounce', async () => {
    const documents = [collectionDocument('players', 3, [{ id: 'p1' }]), photoDocument(1)]
    serveListing(documents)
    serveDocuments(documents)
    serveLocalPhotos([PLAYER_ID])
    syncState.outbox = ['players', 'clubs', PHOTO_UNIT]
    syncState.baselines = {}
    vi.mocked(deletePhoto).mockClear()

    const plan = await planNostromoRestore()
    await applyNostromoRestore(plan)

    expect(syncState.outbox).toEqual(['clubs'])
    expect(cancelDirtyDebounce).toHaveBeenCalled()
    expect(logMessages().join(' ')).toContain("retiré(s) de la file d'attente")
  })

  it('drops the locally stored title over the remote one', async () => {
    const documents = [
      makeDocument({
        id: collectionDocId('trombiTitles'),
        payload: collectionPayload('trombiTitles', [{ teamName: 'Remote' }]),
      }),
    ]
    serveListing(documents)
    serveDocuments(documents)

    const plan = await planNostromoRestore()
    const result = await applyNostromoRestore(plan)

    expect(persistTitles).toHaveBeenCalledWith({ teamName: 'Remote' })
    expect(result.appliedUnits).toEqual(['trombiTitles'])
  })

  it('does nothing for the units the server holds no document for', async () => {
    serveListing([])

    const plan = await planNostromoRestore()
    const result = await applyNostromoRestore(plan)

    expect(replaceAllPlayers).not.toHaveBeenCalled()
    expect(result.skippedUnits).toHaveLength(6)
    expect(result.appliedUnits).toEqual([])
    expect(getDocument).not.toHaveBeenCalled()
  })
})

describe('confirmNostromoRestore', () => {
  it('writes nothing when the user cancels', async () => {
    serveListing([collectionDocument('players', 3, [{ id: 'p1' }])])

    const plan = await planNostromoRestore()
    const result = await confirmNostromoRestore(plan, 'cancel')

    expect(result).toBeUndefined()
    expect(replaceAllPlayers).not.toHaveBeenCalled()
    expect(getDocument).not.toHaveBeenCalled()
    expect(logMessages().join(' ')).toContain("annulée par l'utilisateur")
  })

  it('pulls the remote state when the user confirms', async () => {
    const documents = [collectionDocument('players', 3, [{ id: 'p1' }])]
    serveListing(documents)
    serveDocuments(documents)

    const plan = await planNostromoRestore()
    const result = await confirmNostromoRestore(plan, 'pull')

    expect(replaceAllPlayers).toHaveBeenCalledWith([{ id: 'p1' }])
    expect(result?.appliedUnits).toEqual(['players'])
  })

  it('force-pushes the local state when the user chooses to overwrite', async () => {
    const documents = [collectionDocument('players', 3, [{ id: 'p1' }])]
    serveListing(documents)
    serveDocuments(documents)
    syncState.baselines = { players: makeBaseline({ version: 2 }) }
    vi.mocked(updateDocument).mockResolvedValue(makeDocument({ version: 4 }))

    const plan = await planNostromoRestore()
    const result = await confirmNostromoRestore(plan, 'overwrite')

    expect(updateDocument).toHaveBeenCalledTimes(1)
    expect(result?.appliedUnits).toEqual(['players'])
  })
})

describe('applyNostromoOverwrite', () => {
  it('pushes the local collection over the remote document and re-baselines it', async () => {
    const documents = [collectionDocument('players', 3, [{ id: 'remote' }])]
    serveListing(documents)
    serveDocuments(documents)
    syncState.baselines = { players: makeBaseline({ version: 2 }) }
    vi.mocked(getRawPlayers).mockReturnValue([{ id: 'local-1' }])
    vi.mocked(updateDocument).mockResolvedValue(makeDocument({ version: 4 }))

    const plan = await planNostromoRestore()
    const result = await applyNostromoOverwrite(plan)

    // The token is the version the plan read, never the older baseline: the
    // overwrite must not be refused by the staleness it exists to resolve.
    expect(updateDocument).toHaveBeenCalledWith(BASE_URL, AUTH_TOKEN, PLAYERS_DOC_ID, {
      expectedVersion: 3,
      payload: collectionPayload('players', [{ id: 'local-1' }]),
    })
    expect(syncState.baselines.players).toMatchObject({ docId: PLAYERS_DOC_ID, version: 4 })
    expect(result.appliedUnits).toEqual(['players'])
    expect(result.failedUnits).toEqual([])
    expect(syncState.status).toBe('saved')
  })

  it('forces the local state over a newer remote version and clears the conflict', async () => {
    const documents = [collectionDocument('players', 7, [{ id: 'remote' }])]
    serveListing(documents)
    serveDocuments(documents)
    syncState.baselines = { players: makeBaseline({ conflicted: true, version: 6 }) }
    syncState.outbox = ['players']
    vi.mocked(getRawPlayers).mockReturnValue([{ id: 'local-1' }])
    vi.mocked(updateDocument).mockResolvedValue(makeDocument({ version: 8 }))

    const plan = await planNostromoRestore()
    const result = await applyNostromoOverwrite(plan)

    expect(updateDocument).toHaveBeenCalledWith(BASE_URL, AUTH_TOKEN, PLAYERS_DOC_ID, {
      expectedVersion: 7,
      payload: collectionPayload('players', [{ id: 'local-1' }]),
    })
    expect(syncState.baselines.players).toMatchObject({ docId: PLAYERS_DOC_ID, version: 8 })
    expect(syncState.baselines.players?.conflicted).toBeUndefined()
    expect(syncState.outbox).toEqual([])
    expect(result.appliedUnits).toEqual(['players'])
    expect(result.failedUnits).toEqual([])
    expect(syncState.status).toBe('saved')
  })

  it('keeps a stale unit conflicted and untouched when the server moved again since the plan', async () => {
    const documents = [collectionDocument('players', 7, [{ id: 'remote' }])]
    serveListing(documents)
    serveDocuments(documents)
    syncState.baselines = { players: makeBaseline({ conflicted: true, version: 6 }) }
    syncState.outbox = ['players']
    vi.mocked(getRawPlayers).mockReturnValue([{ id: 'local-1' }])
    vi.mocked(updateDocument).mockRejectedValue(conflict(PLAYERS_DOC_ID))

    const plan = await planNostromoRestore()
    const result = await applyNostromoOverwrite(plan)

    // The write went out with the version the plan read: a 409 can only mean the
    // server moved once more, and the unit keeps both its data and its parking.
    expect(updateDocument).toHaveBeenCalledWith(BASE_URL, AUTH_TOKEN, PLAYERS_DOC_ID, {
      expectedVersion: 7,
      payload: collectionPayload('players', [{ id: 'local-1' }]),
    })
    expect(result.failedUnits).toEqual(['players'])
    expect(result.appliedUnits).toEqual([])
    expect(syncState.baselines.players).toMatchObject({ docId: PLAYERS_DOC_ID, version: 6 })
    expect(syncState.baselines.players?.conflicted).toBe(true)
    expect(syncState.outbox).toEqual(['players'])
    expect(syncState.status).toBe('conflict')
    expect(logMessages().join(' ')).toContain('a dépassé la référence locale')
  })

  it('creates the document of a unit the server does not hold', async () => {
    serveListing([])
    vi.mocked(getRawPlayers).mockReturnValue([{ id: 'local-1' }])
    vi.mocked(createDocument).mockResolvedValue(makeDocument({ version: 1 }))

    const plan = await planNostromoRestore()
    const result = await applyNostromoOverwrite(plan)

    expect(createDocument).toHaveBeenCalledWith(BASE_URL, AUTH_TOKEN, {
      id: collectionDocId('players'),
      owner: USER_ID,
      payload: collectionPayload('players', [{ id: 'local-1' }]),
    })
    expect(syncState.baselines.players).toMatchObject({ docId: PLAYERS_DOC_ID, version: 1 })
    expect(result.appliedUnits).toEqual(['players'])
  })

  it('leaves a unit untouched when the server answers 409 and reports a conflict', async () => {
    const documents = [
      collectionDocument('players', 3, [{ id: 'remote' }]),
      collectionDocument('teams', 2, [], TEAMS_DOC_ID),
    ]
    serveListing(documents)
    serveDocuments(documents)
    syncState.baselines = {
      players: makeBaseline({ version: 2 }),
      teams: makeBaseline({ docId: TEAMS_DOC_ID, version: 1 }),
    }
    vi.mocked(getRawPlayers).mockReturnValue([{ id: 'local-1' }])
    vi.mocked(getRawTeams).mockReturnValue([{ id: 't1' }])
    vi.mocked(updateDocument).mockImplementation((_baseUrl, _token, id) =>
      id === PLAYERS_DOC_ID
        ? Promise.reject(conflict(PLAYERS_DOC_ID))
        : Promise.resolve(makeDocument({ id, version: 9 }))
    )

    const plan = await planNostromoRestore()
    const result = await applyNostromoOverwrite(plan)

    expect(result.failedUnits).toEqual(['players'])
    expect(result.appliedUnits).toEqual(['teams'])
    expect(updateDocument).toHaveBeenCalledWith(BASE_URL, AUTH_TOKEN, PLAYERS_DOC_ID, {
      expectedVersion: 3,
      payload: collectionPayload('players', [{ id: 'local-1' }]),
    })
    expect(syncState.baselines.players).toMatchObject({ version: 2 })
    expect(syncState.baselines.teams).toMatchObject({ version: 9 })
    expect(syncState.status).toBe('conflict')
    expect(logMessages().join(' ')).toContain('a dépassé la référence locale')
  })

  it('skips the units with nothing to push', async () => {
    const documents = [collectionDocument('players', 3, [{ id: 'remote' }])]
    serveListing(documents)
    serveDocuments(documents)
    syncState.baselines = { players: makeBaseline({ version: 3 }) }

    const plan = await planNostromoRestore()
    const result = await applyNostromoOverwrite(plan)

    expect(updateDocument).not.toHaveBeenCalled()
    expect(createDocument).not.toHaveBeenCalled()
    expect(result.skippedUnits).toContain('players')
    expect(result.skippedUnits).toContain('clubs')
    expect(result.appliedUnits).toEqual([])
    expect(syncState.status).toBe('saved')
    expect(logMessages().join(' ')).toContain('correspond déjà à la version distante')
  })

  it('uploads a local photo over the remote document', async () => {
    const documents = [photoDocument(2)]
    serveListing(documents)
    serveDocuments(documents)
    serveLocalPhotos([PLAYER_ID])
    syncState.baselines = { [PHOTO_UNIT]: makeBaseline({ docId: photoDocId(PLAYER_ID), version: 1 }) }
    vi.mocked(getPhoto).mockResolvedValue(makeBlob())
    vi.mocked(updateDocument).mockResolvedValue(photoDocument(3))
    vi.mocked(uploadDocumentFile).mockResolvedValue(photoDocument(4))

    const plan = await planNostromoRestore()
    const result = await applyNostromoOverwrite(plan)

    // The payload update carries the version the plan read, not the older baseline.
    expect(updateDocument).toHaveBeenCalledWith(BASE_URL, AUTH_TOKEN, photoDocId(PLAYER_ID), {
      expectedVersion: 2,
      payload: photoPayload(PLAYER_ID),
    })
    expect(uploadDocumentFile).toHaveBeenCalledWith(BASE_URL, AUTH_TOKEN, photoDocId(PLAYER_ID), {
      expectedVersion: 3,
      file: expect.any(Blob),
      filename: `${PLAYER_ID}.webp`,
    })
    expect(syncState.baselines[PHOTO_UNIT]).toMatchObject({ version: 4 })
    expect(result.appliedUnits).toEqual([PHOTO_UNIT])
  })

  it('never deletes a remote photo the device no longer holds', async () => {
    const documents = [photoDocument(2)]
    serveListing(documents)
    serveDocuments(documents)
    serveLocalPhotos([])

    const plan = await planNostromoRestore()
    const result = await applyNostromoOverwrite(plan)

    expect(uploadDocumentFile).not.toHaveBeenCalled()
    expect(updateDocument).not.toHaveBeenCalled()
    expect(result.skippedUnits).toContain(PHOTO_UNIT)
    expect(logMessages().join(' ')).toContain('aucune copie locale à envoyer')
  })

  it('refuses to upload a photo above the size limit', async () => {
    const documents = [photoDocument(2)]
    serveListing(documents)
    serveDocuments(documents)
    serveLocalPhotos([PLAYER_ID])
    const oversize = makeBlob()
    Object.defineProperty(oversize, 'size', { value: 21 * 1024 * 1024 })
    vi.mocked(getPhoto).mockResolvedValue(oversize)

    const plan = await planNostromoRestore()
    const result = await applyNostromoOverwrite(plan)

    expect(uploadDocumentFile).not.toHaveBeenCalled()
    expect(result.failedUnits).toEqual([PHOTO_UNIT])
    expect(syncState.status).toBe('error')
    expect(logMessages().join(' ')).toContain('au-dessus de la limite')
  })

  it('aborts on a refused session', async () => {
    const documents = [collectionDocument('players', 3, [{ id: 'remote' }])]
    serveListing(documents)
    serveDocuments(documents)
    syncState.baselines = { players: makeBaseline({ version: 2 }) }
    vi.mocked(getRawPlayers).mockReturnValue([{ id: 'local-1' }])
    vi.mocked(updateDocument).mockRejectedValue(authRefusal())

    const plan = await planNostromoRestore()

    await expect(applyNostromoOverwrite(plan)).rejects.toMatchObject({ kind: 'auth' })
    expect(syncState.status).toBe('auth-required')
  })

  it('settles the units it already pushed when a later unit is refused', async () => {
    const documents = [collectionDocument('players', 3, [{ id: 'remote' }]), photoDocument(2)]
    serveListing(documents)
    serveDocuments(documents)
    serveLocalPhotos([PLAYER_ID])
    syncState.baselines = { players: makeBaseline({ version: 2 }) }
    vi.mocked(getRawPlayers).mockReturnValue([{ id: 'local-1' }])
    vi.mocked(getPhoto).mockResolvedValue(makeBlob())
    vi.mocked(updateDocument).mockResolvedValue(makeDocument({ version: 4 }))
    vi.mocked(uploadDocumentFile).mockRejectedValue(authRefusal())

    const plan = await planNostromoRestore()

    await expect(applyNostromoOverwrite(plan)).rejects.toMatchObject({ kind: 'auth' })

    // The players document was pushed before the refusal: its baseline is settled.
    expect(syncState.baselines.players).toMatchObject({ docId: PLAYERS_DOC_ID, version: 4 })
    expect(syncState.status).toBe('auth-required')
  })
})
