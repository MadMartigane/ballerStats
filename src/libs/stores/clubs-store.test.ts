import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClubRawData } from '../club/club.d'
import { storeClubs } from '../store/store'
import {
  addClub,
  assertClubExists,
  getClubById,
  getRawClubs,
  hydrateClubs,
  removeClub,
  replaceAllClubs,
  updateClub,
} from './clubs-store'

/**
 * Tests for the reactive clubs store. The store is a module singleton, so
 * every test resets it with `hydrate([])` (which by design never persists).
 * Persistence is asserted through the explicit mutation functions.
 */
vi.mock('../store/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/store')>()
  return {
    ...actual,
    storeClubs: vi.fn(() => Promise.resolve()),
  }
})

const ALREADY_EXISTS_PATTERN = /already exist/
const NOT_REGISTERABLE_PATTERN = /not registerable/
const DOES_NOT_EXIST_PATTERN = /doesn't exist/

function makeClubData(overrides: Partial<ClubRawData> = {}): ClubRawData {
  return {
    id: 'c1',
    name: 'BCC Marseille',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  hydrateClubs([])
})

describe('clubs-store', () => {
  it('hydrate() loads the collection and never persists', () => {
    hydrateClubs([makeClubData()])

    expect(getRawClubs()).toHaveLength(1)
    expect(storeClubs).not.toHaveBeenCalled()
  })

  it('hydrate() empties the collection when given an empty array', () => {
    hydrateClubs([makeClubData()])
    expect(getRawClubs()).toHaveLength(1)

    hydrateClubs([])

    expect(getRawClubs()).toHaveLength(0)
    expect(storeClubs).not.toHaveBeenCalled()
  })

  it('add() stores the club, makes it retrievable and persists exactly once', () => {
    addClub(makeClubData())

    expect(getRawClubs()).toHaveLength(1)
    expect(getRawClubs()[0].id).toBe('c1')
    expect(storeClubs).toHaveBeenCalledTimes(1)
  })

  it('add() throws for a duplicate id without persisting again', () => {
    addClub(makeClubData({ id: 'c1' }))
    const duplicate = makeClubData({ id: 'c1', name: 'Autre club' })

    expect(() => addClub(duplicate)).toThrow(ALREADY_EXISTS_PATTERN)
    expect(storeClubs).toHaveBeenCalledTimes(1)
  })

  it('add() rejects an unnamed club', () => {
    expect(() => addClub(makeClubData({ name: '' }))).toThrow(NOT_REGISTERABLE_PATTERN)
    expect(storeClubs).not.toHaveBeenCalled()
  })

  it('add() checks registerability before the duplicate id check', () => {
    addClub(makeClubData({ id: 'c1' }))
    const duplicateAndNotRegisterable = makeClubData({ id: 'c1', name: '' })

    expect(() => addClub(duplicateAndNotRegisterable)).toThrow(NOT_REGISTERABLE_PATTERN)
    expect(() => addClub(duplicateAndNotRegisterable)).not.toThrow(ALREADY_EXISTS_PATTERN)
  })

  it('update() updates an existing club and persists once', () => {
    addClub(makeClubData({ name: 'Old' }))

    updateClub('c1', makeClubData({ licenseNumber: '99', name: 'New' }))

    expect(getRawClubs()[0].name).toBe('New')
    expect(getRawClubs()[0].licenseNumber).toBe('99')
    expect(storeClubs).toHaveBeenCalledTimes(2)
  })

  it('update() throws for a non-existent id without persisting', () => {
    expect(() => updateClub('ghost', makeClubData({ id: 'ghost' }))).toThrow(DOES_NOT_EXIST_PATTERN)
    expect(storeClubs).not.toHaveBeenCalled()
  })

  it('remove() removes the club from the collection and persists once', () => {
    hydrateClubs([makeClubData({ id: 'c1' }), makeClubData({ id: 'c2', name: 'Autre' })])

    removeClub('c1')

    expect(getRawClubs().map((raw) => raw.id)).toEqual(['c2'])
    expect(storeClubs).toHaveBeenCalledTimes(1)
  })

  it('remove() accepts a full raw and throws for a non-existent id without persisting', () => {
    addClub(makeClubData())

    expect(() => removeClub(makeClubData({ id: 'ghost' }))).toThrow(DOES_NOT_EXIST_PATTERN)
    expect(storeClubs).toHaveBeenCalledTimes(1)

    removeClub(makeClubData())

    expect(getRawClubs()).toEqual([])
    expect(storeClubs).toHaveBeenCalledTimes(2)
  })

  it('replaceAll() swaps the whole collection and persists exactly once', () => {
    addClub(makeClubData({ name: 'Old' }))

    replaceAllClubs([makeClubData({ id: 'c2', name: 'New' })])

    expect(getRawClubs().map((raw) => raw.id)).toEqual(['c2'])
    expect(storeClubs).toHaveBeenCalledTimes(2)
  })

  it('getClubById() returns a matching club clone or null', () => {
    hydrateClubs([makeClubData()])

    expect(getClubById('c1')?.id).toBe('c1')
    expect(getClubById('ghost')).toBeNull()
  })

  it('mutations compute a pure next array: stored objects are never mutated', () => {
    const raw = makeClubData({ name: 'Original' })
    hydrateClubs([raw])

    // Mutating the raw used for hydration must not affect the store.
    raw.name = 'Mutated input'
    expect(getRawClubs()[0].name).toBe('Original')

    // Mutating a value returned by the clone getter must not affect the store.
    const [retrieved] = getRawClubs()
    retrieved.name = 'Mutated read'
    expect(getRawClubs()[0].name).toBe('Original')

    // Mutating the input of add must not affect the stored object.
    const addedRaw = makeClubData({ id: 'c2', name: 'Added' })
    addClub(addedRaw)
    addedRaw.name = 'Mutated add'
    expect(getRawClubs().find((candidate) => candidate.id === 'c2')?.name).toBe('Added')
  })

  it('assertClubExists() returns the matching club or throws', () => {
    hydrateClubs([makeClubData({ id: 'c1' })])

    expect(assertClubExists(getRawClubs(), 'c1').id).toBe('c1')
    expect(() => assertClubExists(getRawClubs(), 'ghost')).toThrow(DOES_NOT_EXIST_PATTERN)
  })
})
