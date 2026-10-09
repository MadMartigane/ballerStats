import { strToU8, zipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContactRawData } from '../contact/contact.d'
import { clearAllPhotos, getAllPhotoEntries, storePhoto } from '../photo-store/photo-store'
import Player from '../player/player'
import { STORAGE_PLAYERS_KEY } from '../store/store'
import { getRawClubs } from '../stores/clubs-store'
import { getRawPlayers, replaceAllPlayers } from '../stores/players-store'
import { getRawTeams, replaceAllTeams } from '../stores/teams-store'
import Team from '../team/team'
import { confirmAction, toast } from '../utils/utils'
import { isGlobalDB, Orchestrator, ParseError } from './orchestrator'
import type { DomainDataset, GlobalDB } from './orchestrator.d'

// Explicit factory: the real module is kept, and only the UI side effects are stubbed.
// A bare automock would make confirmAction resolve undefined and silently skip the import.
vi.mock('../utils/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/utils')>()
  return {
    ...actual,
    confirmAction: vi.fn(() => Promise.resolve(true)),
    toast: vi.fn(),
  }
})

vi.mock('../photo-store/photo-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../photo-store/photo-store')>()
  return {
    ...actual,
    deletePhotoAndFlag: vi.fn(),
    setPhotoAndFlag: vi.fn(),
  }
})

/**
 * The private parse methods live on the prototype (TypeScript `private` is a
 * compile-time concept). Building an instance via `Object.create` lets the test
 * exercise the real parse paths without running the module's constructor side
 * effects. The typed interface only exposes what the test needs.
 */
interface OrchestratorParseMethods {
  importDB: (event: { currentTarget: HTMLInputElement; target: HTMLInputElement }) => Promise<void>
  parseImportData: (uint8: Uint8Array) => Promise<{ rawData: GlobalDB; photos?: Map<string, Blob> }>
  tryParseZip: (uint8: Uint8Array) => Promise<{ rawData: GlobalDB; photos: Map<string, Blob> } | null>
}

const orchestrator = Object.create(Orchestrator.prototype) as unknown as OrchestratorParseMethods

const ARCHIVE_MIME_TYPE = 'application/octet-stream'

type GlobalArchive = Omit<GlobalDB, 'contacts'> & { contacts: ContactRawData[] | null }

function validArchiveData(): GlobalArchive {
  return {
    contacts: null,
    matchs: [],
    players: [],
    teams: [],
    timestamp: 1_700_000_000_000,
  }
}

function archiveBytes(data: GlobalDB | Record<string, unknown>): Uint8Array {
  return strToU8(JSON.stringify(data))
}

function zipArchiveBytes(data: GlobalDB | Record<string, unknown>): Uint8Array {
  const payload = archiveBytes(data)
  return zipSync({ 'data.json': payload }, {})
}

function fileUploadEvent(uint8: Uint8Array): { currentTarget: HTMLInputElement; target: HTMLInputElement } {
  // Copy into an ArrayBuffer-backed view so the bytes satisfy BlobPart under TS 5.7+.
  const file = new File([new Uint8Array(uint8)], 'archive.bstat', { type: ARCHIVE_MIME_TYPE })
  const input = document.createElement('input')
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  return { currentTarget: input, target: input }
}

describe('isGlobalDB', () => {
  it('rejects when players is missing', () => {
    const { contacts, matchs, teams, timestamp } = validArchiveData()
    expect(isGlobalDB({ contacts, matchs, teams, timestamp })).toBe(false)
  })

  it('rejects when teams is missing', () => {
    const { contacts, matchs, players, timestamp } = validArchiveData()
    expect(isGlobalDB({ contacts, matchs, players, timestamp })).toBe(false)
  })

  it('rejects when matchs is missing', () => {
    const { contacts, players, teams, timestamp } = validArchiveData()
    expect(isGlobalDB({ contacts, players, teams, timestamp })).toBe(false)
  })

  it('rejects when timestamp is falsy', () => {
    expect(isGlobalDB({ ...validArchiveData(), timestamp: 0 })).toBe(false)
  })

  it('rejects non-object values and null', () => {
    expect(isGlobalDB(null)).toBe(false)
    expect(isGlobalDB('{}')).toBe(false)
    expect(isGlobalDB(42)).toBe(false)
    expect(isGlobalDB(undefined)).toBe(false)
  })

  it('accepts a valid shape with null contacts', () => {
    expect(isGlobalDB(validArchiveData())).toBe(true)
  })

  it('accepts empty arrays and an omitted contacts field', () => {
    expect(isGlobalDB({ matchs: [], players: [], teams: [], timestamp: 1 })).toBe(true)
  })

  it('tolerates contacts being null, undefined, or an array', () => {
    expect(isGlobalDB({ ...validArchiveData(), contacts: null })).toBe(true)
    expect(isGlobalDB({ ...validArchiveData(), contacts: [] })).toBe(true)
    expect(isGlobalDB({ ...validArchiveData(), contacts: undefined })).toBe(true)
  })

  it('rejects when a required collection is not an array', () => {
    expect(isGlobalDB({ ...validArchiveData(), players: 'nope' })).toBe(false)
    expect(isGlobalDB({ ...validArchiveData(), teams: {} })).toBe(false)
  })
})

describe('ParseError', () => {
  it('is named ParseError', () => {
    expect(new ParseError('boom').name).toBe('ParseError')
  })
})

describe('parseImportData (legacy JSON path)', () => {
  it('rejects malformed JSON with a ParseError instead of an unhandled TypeError', async () => {
    const { teams, timestamp } = validArchiveData()
    const malformed = JSON.stringify({ teams, timestamp })
    await expect(orchestrator.parseImportData(strToU8(malformed))).rejects.toBeInstanceOf(ParseError)
    await expect(orchestrator.parseImportData(strToU8(malformed))).rejects.toThrow('Invalid archive data')
  })

  it('parses a well-formed archive into a GlobalDB', async () => {
    const result = await orchestrator.parseImportData(archiveBytes(validArchiveData()))
    expect(result.rawData).toMatchObject({
      contacts: null,
      matchs: [],
      players: [],
      teams: [],
    })
    expect(result.rawData.timestamp).toBe(1_700_000_000_000)
    expect(result.photos).toBeUndefined()
  })
})

describe('tryParseZip (zip path)', () => {
  it('rejects a zipped archive missing players with a ParseError', async () => {
    const { teams, timestamp } = validArchiveData()
    const zipped = zipArchiveBytes({ teams, timestamp })
    await expect(orchestrator.tryParseZip(zipped)).rejects.toBeInstanceOf(ParseError)
    await expect(orchestrator.tryParseZip(zipped)).rejects.toThrow('Invalid archive data')
  })

  it('rejects a zip missing data.json with a ParseError', async () => {
    const zipped = zipSync({ 'other.json': strToU8('{}') }, {})
    await expect(orchestrator.tryParseZip(zipped)).rejects.toThrow('Missing data.json in archive')
  })

  it('parses a well-formed zipped archive into a GlobalDB', async () => {
    const result = await orchestrator.tryParseZip(zipArchiveBytes(validArchiveData()))
    expect(result?.rawData).toMatchObject({
      contacts: null,
      matchs: [],
      players: [],
      teams: [],
    })
  })

  it('treats non-zip bytes as a legacy fallback signal (returns null)', async () => {
    const arbitrary = strToU8('this is not a zip archive at all')
    await expect(orchestrator.tryParseZip(arbitrary)).resolves.toBeNull()
  })
})

describe('importDB flow', () => {
  beforeEach(async () => {
    vi.mocked(confirmAction).mockReset()
    vi.mocked(confirmAction).mockImplementation(() => Promise.resolve(true))
    vi.clearAllMocks()
    replaceAllPlayers([])
    replaceAllTeams([])
    await clearAllPhotos()
  })

  it('rejects a malformed archive before reaching confirmation', async () => {
    const { teams, timestamp } = validArchiveData()
    const uint8 = zipArchiveBytes({ teams, timestamp })

    await expect(orchestrator.importDB(fileUploadEvent(uint8))).resolves.toBeUndefined()

    expect(confirmAction).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('Données non valides.', 'error')
  })

  it('imports players and teams from a plain-JSON legacy file when both confirmations are accepted', async () => {
    await storePhoto('p-stale', new Blob(['stale'], { type: 'image/webp' }))
    const archive = {
      ...validArchiveData(),
      players: [{ firstName: 'Imported', id: 'p-imported', jerseyNumber: '7', lastName: 'Player' }],
      teams: [{ id: 't-imported', name: 'Imported Team' }],
    }

    await expect(orchestrator.importDB(fileUploadEvent(archiveBytes(archive)))).resolves.toBeUndefined()

    expect(confirmAction).toHaveBeenCalledTimes(2)
    expect(await getAllPhotoEntries()).toHaveLength(0)
    expect(vi.mocked(confirmAction).mock.calls[0][1]).toContain('1 joueurs, 1 équipes')
    expect(vi.mocked(confirmAction).mock.calls[1][1]).toBe('Voulez-vous écraser toutes les données ?')
    expect(getRawPlayers().map((player) => player.id)).toEqual(['p-imported'])
    expect(getRawTeams().map((team) => team.id)).toEqual(['t-imported'])
    expect(toast).toHaveBeenCalledWith('Import des nouvelles données réussi !', 'success')
  })

  it('imports nothing when the first confirmation is declined', async () => {
    vi.mocked(confirmAction).mockImplementationOnce(() => Promise.resolve(false))
    const archive = {
      ...validArchiveData(),
      players: [{ firstName: 'Imported', id: 'p-imported', lastName: 'Player' }],
    }

    await orchestrator.importDB(fileUploadEvent(archiveBytes(archive)))

    expect(confirmAction).toHaveBeenCalledTimes(1)
    expect(getRawPlayers()).toEqual([])
    expect(toast).not.toHaveBeenCalled()
  })

  it('keeps stored photos when the overwrite confirmation is declined', async () => {
    vi.mocked(confirmAction)
      .mockImplementationOnce(() => Promise.resolve(true))
      .mockImplementationOnce(() => Promise.resolve(false))
    await storePhoto('p-existing', new Blob(['kept'], { type: 'image/webp' }))
    const archive = {
      ...validArchiveData(),
      players: [{ firstName: 'Imported', id: 'p-imported', lastName: 'Player' }],
    }

    await orchestrator.importDB(fileUploadEvent(archiveBytes(archive)))

    expect(confirmAction).toHaveBeenCalledTimes(2)
    expect(await getAllPhotoEntries()).toHaveLength(1)
    expect(toast).toHaveBeenCalledWith('Import des nouvelles données réussi !', 'success')
  })
})

const datasetOrchestrator = Object.create(Orchestrator.prototype) as Orchestrator

describe('replaceDataset', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await clearAllPhotos()
  })

  it('clears every stored photo before committing the dataset', async () => {
    await storePhoto('stale-player', new Blob(['stale'], { type: 'image/webp' }))
    expect(await getAllPhotoEntries()).toHaveLength(1)

    const dataset: DomainDataset = {
      players: [new Player({ firstName: 'A', id: 'player-a', jerseyNumber: '1', lastName: 'B' })],
    }

    await datasetOrchestrator.replaceDataset(dataset)

    expect(await getAllPhotoEntries()).toHaveLength(0)
  })

  it('runs the club migration and persists the migrated outputs', async () => {
    const dataset: DomainDataset = {
      players: [new Player({ firstName: 'A', id: 'player-a', jerseyNumber: '1', lastName: 'B' })],
      teams: [new Team({ id: 'team-a', name: 'Team A' })],
    }

    await datasetOrchestrator.replaceDataset(dataset)

    const clubs = getRawClubs()
    const players = getRawPlayers()
    expect(clubs).toHaveLength(1)
    expect(players).toHaveLength(1)
    expect(players[0].clubId).toBe(clubs[0].id)

    // The migrated player must be the one that reached localStorage, not the raw input.
    const stored = JSON.parse(localStorage.getItem(STORAGE_PLAYERS_KEY) ?? 'null') as {
      data?: { clubId?: string }[]
    }
    expect(stored.data?.[0]?.clubId).toBe(clubs[0].id)
  })
})
