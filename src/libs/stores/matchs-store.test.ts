import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchRawData, MatchStatLogEntry } from '../match/match.d'
import { storeMatchs } from '../store/store'
import {
  addMatch,
  assertMatchExists,
  getMatchById,
  getRawMatchs,
  hydrateMatchs,
  removeMatch,
  replaceAllMatchs,
  updateMatch,
} from './matchs-store'

/**
 * Tests for the reactive matchs store. The store is a module singleton, so
 * every test resets it with `hydrate([])` (which by design never persists).
 * Persistence is asserted through the explicit mutation functions.
 */
vi.mock('../store/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/store')>()
  return {
    ...actual,
    storeMatchs: vi.fn(() => Promise.resolve()),
  }
})

const ALREADY_EXISTS_PATTERN = /already exists/
const NON_REGISTERABLE_PATTERN = /not registerable/
const DOES_NOT_EXIST_PATTERN = /doesn't exist/

function makeStat(): MatchStatLogEntry {
  return { name: '2pts', playerId: 'p1', timestamp: 1, type: 'success', value: 2 }
}

function makeMatchData(overrides: Partial<MatchRawData> = {}): MatchRawData {
  return {
    id: 'm1',
    opponent: 'Ostende',
    playersInTheFive: [],
    stats: [],
    status: 'unlocked',
    teamId: 't1',
    type: 'home',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  hydrateMatchs([])
})

describe('matchs-store', () => {
  it('hydrate() loads the collection and never persists', () => {
    hydrateMatchs([makeMatchData()])

    expect(getRawMatchs()).toHaveLength(1)
    expect(storeMatchs).not.toHaveBeenCalled()
  })

  it('add() stores the match, makes it retrievable and persists exactly once', () => {
    addMatch(makeMatchData())

    expect(getRawMatchs()).toHaveLength(1)
    expect(getRawMatchs()[0].id).toBe('m1')
    expect(storeMatchs).toHaveBeenCalledTimes(1)
  })

  it('add() throws for a duplicate id without persisting again', () => {
    addMatch(makeMatchData({ id: 'm1' }))
    const duplicate = makeMatchData({ id: 'm1', opponent: 'Another Team' })

    expect(() => addMatch(duplicate)).toThrow(ALREADY_EXISTS_PATTERN)
    expect(storeMatchs).toHaveBeenCalledTimes(1)
  })

  it('add() throws for missing registerable data (opponent, type, teamId)', () => {
    expect(() => addMatch(makeMatchData({ opponent: null }))).toThrow(NON_REGISTERABLE_PATTERN)
    expect(() => addMatch(makeMatchData({ type: undefined }))).toThrow(NON_REGISTERABLE_PATTERN)
    expect(() => addMatch(makeMatchData({ teamId: null }))).toThrow(NON_REGISTERABLE_PATTERN)
    expect(storeMatchs).not.toHaveBeenCalled()
  })

  it('add() checks registerability before the duplicate id check', () => {
    addMatch(makeMatchData({ id: 'm1' }))
    const duplicateAndNotRegisterable = makeMatchData({ id: 'm1', opponent: null })

    expect(() => addMatch(duplicateAndNotRegisterable)).toThrow(NON_REGISTERABLE_PATTERN)
    expect(() => addMatch(duplicateAndNotRegisterable)).not.toThrow(ALREADY_EXISTS_PATTERN)
  })

  it('update() updates an existing match and persists once', () => {
    addMatch(makeMatchData({ opponent: 'Ostende' }))

    updateMatch('m1', makeMatchData({ opponent: 'Charleroi' }))

    expect(getRawMatchs()[0].opponent).toBe('Charleroi')
    expect(storeMatchs).toHaveBeenCalledTimes(2)
  })

  it('update() throws for a non-existent id without persisting', () => {
    expect(() => updateMatch('ghost', makeMatchData({ id: 'ghost' }))).toThrow(DOES_NOT_EXIST_PATTERN)
    expect(storeMatchs).not.toHaveBeenCalled()
  })

  it('remove() removes the match and persists once', () => {
    addMatch(makeMatchData())

    removeMatch('m1')

    expect(getRawMatchs()).toEqual([])
    expect(storeMatchs).toHaveBeenCalledTimes(2)
  })

  it('remove() accepts a full raw and throws for a non-existent id without persisting', () => {
    addMatch(makeMatchData())

    expect(() => removeMatch(makeMatchData({ id: 'ghost' }))).toThrow(DOES_NOT_EXIST_PATTERN)
    expect(storeMatchs).toHaveBeenCalledTimes(1)

    removeMatch(makeMatchData())

    expect(getRawMatchs()).toEqual([])
    expect(storeMatchs).toHaveBeenCalledTimes(2)
  })

  it('replaceAll() swaps the whole collection and persists exactly once', () => {
    addMatch(makeMatchData({ opponent: 'Old' }))

    replaceAllMatchs([makeMatchData({ id: 'm2', opponent: 'New' })])

    expect(getRawMatchs().map((raw) => raw.id)).toEqual(['m2'])
    expect(storeMatchs).toHaveBeenCalledTimes(2)
  })

  it('getMatchById() returns a matching match clone or null', () => {
    hydrateMatchs([makeMatchData()])

    expect(getMatchById('m1')?.id).toBe('m1')
    expect(getMatchById('ghost')).toBeNull()
  })

  it('mutations compute a pure next array: stored objects (and nested stats) are never mutated', () => {
    const raw = makeMatchData({ stats: [makeStat()] })
    const rawStats = raw.stats ?? []
    hydrateMatchs([raw])

    // Mutating the raw used for hydration must not affect the store.
    raw.opponent = 'Mutated input'
    rawStats[0].value = 99
    expect(getRawMatchs()[0].opponent).toBe('Ostende')
    expect(getRawMatchs()[0].stats?.[0].value).toBe(2)

    // Mutating a value returned by the clone getter must not affect the store.
    const [retrieved] = getRawMatchs()
    retrieved.opponent = 'Mutated read'
    const readStats = retrieved.stats ?? []
    readStats[0].value = 55
    expect(getRawMatchs()[0].opponent).toBe('Ostende')
    expect(getRawMatchs()[0].stats?.[0].value).toBe(2)

    // Mutating the input of add must not affect the stored object.
    const addedRaw = makeMatchData({ id: 'm2', opponent: 'Added', stats: [{ ...makeStat(), value: 3 }] })
    const addedStats = addedRaw.stats ?? []
    addMatch(addedRaw)
    addedStats[0].value = 42
    expect(getRawMatchs().find((candidate) => candidate.id === 'm2')?.stats?.[0].value).toBe(3)
  })

  it('assertMatchExists() returns the matching match or throws', () => {
    hydrateMatchs([makeMatchData({ id: 'm1' })])

    expect(assertMatchExists(getRawMatchs(), 'm1').id).toBe('m1')
    expect(() => assertMatchExists(getRawMatchs(), 'ghost')).toThrow(DOES_NOT_EXIST_PATTERN)
  })
})
