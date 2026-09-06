import { beforeEach, describe, expect, it, vi } from 'vitest'
import { storeTeams } from '../store/store'
import type { TeamRawData } from '../team/team.d'
import {
  addTeam,
  assertTeamExists,
  getRawTeams,
  getTeamById,
  hydrateTeams,
  removeTeam,
  replaceAllTeams,
  updateTeam,
} from './teams-store'

/**
 * Tests for the reactive teams store. The store is a module singleton, so
 * every test resets it with `hydrate([])` (which by design never persists).
 * Persistence is asserted through the explicit mutation functions.
 */
vi.mock('../store/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/store')>()
  return {
    ...actual,
    storeTeams: vi.fn(() => Promise.resolve()),
  }
})

const ALREADY_EXISTS_PATTERN = /already exists/
const NON_REGISTERABLE_PATTERN = /not registerable/
const DOES_NOT_EXIST_PATTERN = /doesn't exist/

function makeTeamData(overrides: Partial<TeamRawData> = {}): TeamRawData {
  return {
    id: 't1',
    name: 'BCC U09',
    playerIds: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  hydrateTeams([])
})

describe('teams-store', () => {
  it('hydrate() loads the collection and never persists', () => {
    hydrateTeams([makeTeamData()])

    expect(getRawTeams()).toHaveLength(1)
    expect(storeTeams).not.toHaveBeenCalled()
  })

  it('add() stores the team, makes it retrievable and persists exactly once', () => {
    addTeam(makeTeamData())

    expect(getRawTeams()).toHaveLength(1)
    expect(getRawTeams()[0].id).toBe('t1')
    expect(storeTeams).toHaveBeenCalledTimes(1)
  })

  it('add() throws for a duplicate id without persisting again', () => {
    addTeam(makeTeamData({ id: 't1' }))
    const duplicate = makeTeamData({ id: 't1', name: 'Other Team' })

    expect(() => addTeam(duplicate)).toThrow(ALREADY_EXISTS_PATTERN)
    expect(storeTeams).toHaveBeenCalledTimes(1)
  })

  it('add() throws for a missing name', () => {
    expect(() => addTeam(makeTeamData({ name: '', playerIds: ['p1'] }))).toThrow(NON_REGISTERABLE_PATTERN)
    expect(storeTeams).not.toHaveBeenCalled()
  })

  it('add() checks registerability before the duplicate id check', () => {
    addTeam(makeTeamData({ id: 't1' }))
    const duplicateAndNotRegisterable = makeTeamData({ id: 't1', name: '' })

    expect(() => addTeam(duplicateAndNotRegisterable)).toThrow(NON_REGISTERABLE_PATTERN)
    expect(() => addTeam(duplicateAndNotRegisterable)).not.toThrow(ALREADY_EXISTS_PATTERN)
  })

  it('update() updates an existing team and persists once', () => {
    addTeam(makeTeamData({ name: 'BCC U09' }))

    updateTeam('t1', makeTeamData({ name: 'BCC U11' }))

    expect(getRawTeams()[0].name).toBe('BCC U11')
    expect(storeTeams).toHaveBeenCalledTimes(2)
  })

  it('update() throws for a non-existent id without persisting', () => {
    expect(() => updateTeam('ghost', makeTeamData({ id: 'ghost' }))).toThrow(DOES_NOT_EXIST_PATTERN)
    expect(storeTeams).not.toHaveBeenCalled()
  })

  it('remove() removes the team and persists once', () => {
    addTeam(makeTeamData())

    removeTeam('t1')

    expect(getRawTeams()).toEqual([])
    expect(storeTeams).toHaveBeenCalledTimes(2)
  })

  it('remove() accepts a full raw and throws for a non-existent id without persisting', () => {
    addTeam(makeTeamData())

    expect(() => removeTeam(makeTeamData({ id: 'ghost' }))).toThrow(DOES_NOT_EXIST_PATTERN)
    expect(storeTeams).toHaveBeenCalledTimes(1)

    removeTeam(makeTeamData())

    expect(getRawTeams()).toEqual([])
    expect(storeTeams).toHaveBeenCalledTimes(2)
  })

  it('replaceAll() swaps the whole collection and persists exactly once', () => {
    addTeam(makeTeamData({ name: 'Old' }))

    replaceAllTeams([makeTeamData({ id: 't2', name: 'New' })])

    expect(getRawTeams().map((raw) => raw.id)).toEqual(['t2'])
    expect(storeTeams).toHaveBeenCalledTimes(2)
  })

  it('getTeamById() returns a matching team clone or null', () => {
    hydrateTeams([makeTeamData()])

    expect(getTeamById('t1')?.id).toBe('t1')
    expect(getTeamById('ghost')).toBeNull()
  })

  it('mutations compute a pure next array: stored objects are never mutated', () => {
    const raw = makeTeamData({ name: 'Original' })
    hydrateTeams([raw])

    // Mutating the raw used for hydration must not affect the store.
    raw.name = 'Mutated input'
    expect(getRawTeams()[0].name).toBe('Original')

    // Mutating a value returned by the clone getter must not affect the store.
    const [retrieved] = getRawTeams()
    retrieved.name = 'Mutated read'
    expect(getRawTeams()[0].name).toBe('Original')

    // Mutating the input of add must not affect the stored object.
    const addedRaw = makeTeamData({ id: 't2', name: 'Added' })
    addTeam(addedRaw)
    addedRaw.name = 'Mutated add'
    expect(getRawTeams().find((candidate) => candidate.id === 't2')?.name).toBe('Added')
  })

  it('assertTeamExists() returns the matching team or throws', () => {
    hydrateTeams([makeTeamData({ id: 't1' })])

    expect(assertTeamExists(getRawTeams(), 't1').id).toBe('t1')
    expect(() => assertTeamExists(getRawTeams(), 'ghost')).toThrow(DOES_NOT_EXIST_PATTERN)
  })
})
