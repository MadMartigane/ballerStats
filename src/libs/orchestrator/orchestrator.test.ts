import { strToU8, zipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContactRawData } from '../contact/contact.d'
import { confirmAction, toast } from '../utils/utils'
import { isGlobalDB, Orchestrator, ParseError } from './orchestrator'
import type { GlobalDB } from './orchestrator.d'

vi.mock('../utils/utils')

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
  beforeEach(() => {
    vi.clearAllMocks()
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
})
