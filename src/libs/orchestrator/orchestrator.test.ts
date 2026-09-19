import { strToU8, zipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContactRawData } from '../contact/contact.d'
import type { MatchRawData } from '../match/match.d'
import { deleteOrphanRemotePhotos, listOrphanRemotePhotos } from '../nostromo/import-orphans'
import { captureRemoteSnapshot } from '../nostromo/remote-snapshot'
import { clearAllPhotos } from '../photo-store/photo-store'
import { hydrateClubs } from '../stores/clubs-store'
import { hydrateContacts } from '../stores/contacts-store'
import { addMatch, getRawMatchs, hydrateMatchs, replaceAllMatchs } from '../stores/matchs-store'
import { hydratePlayers } from '../stores/players-store'
import { addTeam, getRawTeams, hydrateTeams, replaceAllTeams } from '../stores/teams-store'
import type { TeamRawData } from '../team/team.d'
import { confirmAction, toast } from '../utils/utils'
import { isGlobalDB, Orchestrator, ParseError } from './orchestrator'
import type { DomainDataset, GlobalDB } from './orchestrator.d'

vi.mock('../utils/utils')

/**
 * `batch` is the atomicity boundary under test: the probe lets a test assert
 * that the collection replacements happened while a batch was open, without
 * changing what `batch` does.
 */
const batchProbe = vi.hoisted(() => ({
  depth: 0,
  matchReplacementDepths: [] as number[],
  teamReplacementDepths: [] as number[],
}))

vi.mock('solid-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('solid-js')>()
  return {
    ...actual,
    batch: (fn: () => void) => {
      batchProbe.depth += 1
      try {
        return actual.batch(fn)
      } finally {
        batchProbe.depth -= 1
      }
    },
  }
})

/** Persistence funnels are mocked so an overwrite never touches storage. */
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

/** Keeps the `.bstat` import flow independent from the sync layer. */
vi.mock('../nostromo/dirty-marks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../nostromo/dirty-marks')>()
  return {
    ...actual,
    markCollectionDirty: vi.fn(),
  }
})

/** The sync edges are mocked: the import flow is asserted, not the sync layer itself. */
vi.mock('../nostromo/import-orphans', () => ({
  deleteOrphanRemotePhotos: vi.fn(() => Promise.resolve({ deleted: [], failed: [] })),
  listOrphanRemotePhotos: vi.fn(() => Promise.resolve([])),
}))

vi.mock('../nostromo/remote-snapshot', () => ({
  captureRemoteSnapshot: vi.fn(() => Promise.resolve()),
}))

// The teams/matchs stores run for real; only the replacement funnel is spied on
// (and the cumulative `add*` path is trapped so a regression is caught).
vi.mock('../stores/teams-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stores/teams-store')>()
  return {
    ...actual,
    // Delegating mock: it still throws on a duplicate id like the real funnel,
    // so the double-import test catches a regression back to cumulative adds.
    addTeam: vi.fn(actual.addTeam),
    replaceAllTeams: vi.fn((raws: TeamRawData[]) => {
      batchProbe.teamReplacementDepths.push(batchProbe.depth)
      actual.replaceAllTeams(raws)
    }),
  }
})

vi.mock('../stores/matchs-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stores/matchs-store')>()
  return {
    ...actual,
    addMatch: vi.fn(actual.addMatch),
    replaceAllMatchs: vi.fn((raws: MatchRawData[]) => {
      batchProbe.matchReplacementDepths.push(batchProbe.depth)
      actual.replaceAllMatchs(raws)
    }),
  }
})

vi.mock('../photo-store/photo-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../photo-store/photo-store')>()
  return {
    ...actual,
    clearAllPhotos: vi.fn(actual.clearAllPhotos),
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
  doClearDB: () => Promise<void>
  doOverwriteDB: (json: GlobalDB) => Promise<void>
  executeImport: (rawData: GlobalDB, photos?: Map<string, Blob>) => Promise<unknown>
  importDB: (event: { currentTarget: HTMLInputElement; target: HTMLInputElement }) => Promise<void>
  parseImportData: (uint8: Uint8Array) => Promise<{ rawData: GlobalDB; photos?: Map<string, Blob> }>
  replaceDataset: (dataset: DomainDataset) => Promise<void>
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

/** A zipped archive holding one player and its photo blob. */
function zipArchiveWithPhoto(): Uint8Array {
  const data = {
    contacts: null,
    matchs: [],
    players: [{ clubId: 'c1', firstName: 'Nina', hasPhoto: true, id: 'p1', jerseyNumber: '10', lastName: 'Dupont' }],
    teams: [],
    timestamp: 1_700_000_000_000,
  }
  return zipSync({ 'data.json': strToU8(JSON.stringify(data)), 'photos/p1.webp': new Uint8Array([1, 2, 3]) }, {})
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
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listOrphanRemotePhotos).mockResolvedValue([])
    vi.mocked(deleteOrphanRemotePhotos).mockResolvedValue({ deleted: [], failed: [] })
    vi.mocked(captureRemoteSnapshot).mockResolvedValue(undefined)
  })

  it('rejects a malformed archive before reaching confirmation', async () => {
    const { teams, timestamp } = validArchiveData()
    const uint8 = zipArchiveBytes({ teams, timestamp })

    await expect(orchestrator.importDB(fileUploadEvent(uint8))).resolves.toBeUndefined()

    expect(confirmAction).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('Données non valides.', 'error')
  })

  it('reads a plain-JSON legacy file and parses it successfully before confirmation', async () => {
    const uint8 = archiveBytes(validArchiveData())

    await expect(orchestrator.importDB(fileUploadEvent(uint8))).resolves.toBeUndefined()

    expect(confirmAction).toHaveBeenCalledTimes(1)
    expect(toast).not.toHaveBeenCalled()
  })

  it('announces and deletes the remote photos the archive does not hold', async () => {
    const orphan = { docId: 'ph0000000000002', playerId: 'p2', unit: 'photo:p2' }
    vi.mocked(confirmAction).mockResolvedValue(true)
    vi.mocked(listOrphanRemotePhotos).mockResolvedValue([orphan])
    vi.mocked(deleteOrphanRemotePhotos).mockResolvedValue({ deleted: ['p2'], failed: [] })

    await expect(orchestrator.importDB(fileUploadEvent(zipArchiveWithPhoto()))).resolves.toBeUndefined()

    // Import confirmation, overwrite confirmation, then the orphan announcement.
    expect(confirmAction).toHaveBeenCalledTimes(3)
    expect(listOrphanRemotePhotos).toHaveBeenCalledWith(new Set(['p1']), undefined)
    expect(deleteOrphanRemotePhotos).toHaveBeenCalledWith([orphan])
  })

  it('skips the orphan cleanup entirely when the user declines the local wipe', async () => {
    const orphan = { docId: 'ph0000000000002', playerId: 'p2', unit: 'photo:p2' }
    vi.mocked(listOrphanRemotePhotos).mockResolvedValue([orphan])
    // Import confirmed, overwrite declined: no local wipe, so the previous
    // photos stay on the device.
    vi.mocked(confirmAction).mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    await expect(orchestrator.importDB(fileUploadEvent(archiveBytes(validArchiveData())))).resolves.toBeUndefined()

    // Deleting their remote documents would leave local blobs with no server
    // copy: the cleanup must not even list.
    expect(listOrphanRemotePhotos).not.toHaveBeenCalled()
    expect(deleteOrphanRemotePhotos).not.toHaveBeenCalled()
  })

  it('deletes nothing when the archive covers every remote photo', async () => {
    vi.mocked(confirmAction).mockResolvedValue(true)

    await expect(orchestrator.importDB(fileUploadEvent(archiveBytes(validArchiveData())))).resolves.toBeUndefined()

    expect(confirmAction).toHaveBeenCalledTimes(2)
    expect(deleteOrphanRemotePhotos).not.toHaveBeenCalled()
  })

  it('aborts the import when the local wipe fails, with a toast and no rejection', async () => {
    vi.mocked(confirmAction).mockResolvedValue(true)
    vi.mocked(clearAllPhotos).mockRejectedValueOnce(new Error('partial wipe'))

    await expect(orchestrator.importDB(fileUploadEvent(archiveBytes(validArchiveData())))).resolves.toBeUndefined()

    // The wipe ran (snapshot + local replacement) but failed before completing:
    // the import must not overwrite anything on a half-cleared database.
    expect(captureRemoteSnapshot).toHaveBeenCalledWith('vidage')
    expect(captureRemoteSnapshot).not.toHaveBeenCalledWith('import de sauvegarde')
    expect(listOrphanRemotePhotos).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith("Échec du nettoyage local : l'import a été annulé.", 'error')
  })

  it('keeps the remote photos when the user declines the orphan deletion', async () => {
    const orphan = { docId: 'ph0000000000002', playerId: 'p2', unit: 'photo:p2' }
    vi.mocked(listOrphanRemotePhotos).mockResolvedValue([orphan])
    vi.mocked(confirmAction).mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    await expect(orchestrator.importDB(fileUploadEvent(archiveBytes(validArchiveData())))).resolves.toBeUndefined()

    expect(deleteOrphanRemotePhotos).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('conservées'), 'warning')
  })
})

describe('doOverwriteDB (full atomic overwrite)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    batchProbe.depth = 0
    batchProbe.matchReplacementDepths.length = 0
    batchProbe.teamReplacementDepths.length = 0
    hydrateClubs([])
    hydrateContacts([])
    hydrateMatchs([])
    hydratePlayers([])
    hydrateTeams([])
  })

  /**
   * Teams carry no clubId in the archive: `migrateClubData` is expected to stamp
   * them from the archive's club, exactly like the players path.
   */
  function overwriteArchive(): GlobalDB {
    return {
      clubs: [{ id: 'c1', name: 'BCC Marseille' }],
      contacts: [{ firstName: 'Marie', id: 'ct1', playerId: 'p1' }],
      matchs: [
        { id: 'm1', opponent: 'ABC', teamId: 't1', type: 'home' },
        { id: 'm2', opponent: 'DEF', teamId: 't1', type: 'outside' },
      ],
      players: [
        { clubId: 'c1', firstName: 'Nina', id: 'p1', jerseyNumber: '10', lastName: 'Dupont' },
        { clubId: 'c1', firstName: 'Léa', id: 'p2', jerseyNumber: '7', lastName: 'Martin' },
      ],
      teams: [
        { id: 't1', name: 'Seniors' },
        { id: 't2', name: 'U15' },
      ],
      timestamp: 1_700_000_000_000,
    }
  }

  it('importing the same archive twice does not throw and does not duplicate', async () => {
    const archive = overwriteArchive()

    await expect(orchestrator.executeImport(archive)).resolves.toBeUndefined()
    await expect(orchestrator.executeImport(archive)).resolves.toBeUndefined()

    expect(getRawTeams().map((team) => team.id)).toEqual(['t1', 't2'])
    expect(getRawMatchs().map((match) => match.id)).toEqual(['m1', 'm2'])
    const teamCalls = vi.mocked(replaceAllTeams).mock.calls
    const matchCalls = vi.mocked(replaceAllMatchs).mock.calls
    expect(teamCalls).toHaveLength(2)
    expect(matchCalls).toHaveLength(2)
    // Same replacement payload both times: no accumulation between imports.
    const [[firstTeams], [secondTeams]] = teamCalls
    const [[firstMatchs], [secondMatchs]] = matchCalls
    expect(firstTeams).toEqual(secondTeams)
    expect(firstMatchs).toEqual(secondMatchs)
  })

  it('replaces teams and matchs through replaceAll* inside the batch, never through add*', async () => {
    const archive = overwriteArchive()

    await orchestrator.doOverwriteDB(archive)

    const [[replacedTeams]] = vi.mocked(replaceAllTeams).mock.calls
    expect(replacedTeams).toEqual([
      { clubId: 'c1', id: 't1', name: 'Seniors' },
      { clubId: 'c1', id: 't2', name: 'U15' },
    ])
    const [[replacedMatchs]] = vi.mocked(replaceAllMatchs).mock.calls
    expect(replacedMatchs).toEqual(archive.matchs)
    // The cumulative add path is gone: an overwrite never adds on top.
    expect(addTeam).not.toHaveBeenCalled()
    expect(addMatch).not.toHaveBeenCalled()
    // The replacement happens with the batch open: the commit is atomic.
    expect(batchProbe.teamReplacementDepths).toEqual([1])
    expect(batchProbe.matchReplacementDepths).toEqual([1])
  })
})

describe('destructive flow snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(captureRemoteSnapshot).mockResolvedValue(undefined)
    hydrateClubs([])
    hydrateContacts([])
    hydrateMatchs([])
    hydratePlayers([])
    hydrateTeams([])
  })

  it('captures the remote state before a wipe', async () => {
    await expect(orchestrator.doClearDB()).resolves.toBeUndefined()

    expect(captureRemoteSnapshot).toHaveBeenCalledWith('vidage')
  })

  it('captures the remote state before a dataset replacement', async () => {
    await expect(orchestrator.replaceDataset({} as DomainDataset)).resolves.toBeUndefined()

    expect(captureRemoteSnapshot).toHaveBeenCalledWith('jeu de démonstration')
  })

  it('captures the remote state before an import overwrite', async () => {
    await expect(orchestrator.executeImport(validArchiveData() as GlobalDB)).resolves.toBeUndefined()

    expect(captureRemoteSnapshot).toHaveBeenCalledWith('import de sauvegarde')
  })

  it('does not block the flow when the capture fails', async () => {
    vi.mocked(captureRemoteSnapshot).mockRejectedValue(new Error('offline'))

    await expect(orchestrator.doClearDB()).resolves.toBeUndefined()
    expect(captureRemoteSnapshot).toHaveBeenCalledWith('vidage')
  })
})
