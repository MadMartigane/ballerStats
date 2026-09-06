import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContactRawData } from '../contact/contact.d'
import { storeContacts } from '../store/store'
import {
  addContact,
  assertContactExists,
  getContactsByPlayerId,
  getRawContacts,
  hydrateContacts,
  removeContact,
  replacePlayerContacts,
  updateContact,
} from './contacts-store'

/**
 * Tests for the reactive contacts store. The store is a module singleton, so
 * every test resets it with `hydrate([])` (which by design never persists).
 * Persistence is asserted through the explicit mutation functions.
 */
vi.mock('../store/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/store')>()
  return {
    ...actual,
    storeContacts: vi.fn(() => Promise.resolve()),
  }
})

const ALREADY_EXISTS_PATTERN = /already exists/
const MISSING_PLAYER_ID_PATTERN = /playerId/
const NOT_REGISTERABLE_PATTERN = /not registerable/
const DOES_NOT_EXIST_PATTERN = /doesn't exist/

function makeContactData(overrides: Partial<ContactRawData> = {}): ContactRawData {
  return {
    id: 'c1',
    playerId: 'p1',
    relationship: 'mother',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  hydrateContacts([])
})

describe('contacts-store', () => {
  it('hydrate() loads the collection and never persists', () => {
    hydrateContacts([makeContactData()])

    expect(getRawContacts()).toHaveLength(1)
    expect(storeContacts).not.toHaveBeenCalled()
  })

  it('add() stores the contact, makes it retrievable and persists exactly once', () => {
    addContact(makeContactData())

    expect(getRawContacts()).toHaveLength(1)
    expect(getRawContacts()[0].id).toBe('c1')
    expect(storeContacts).toHaveBeenCalledTimes(1)
  })

  it('add() throws for a duplicate id without persisting again', () => {
    addContact(makeContactData({ id: 'c1', playerId: 'p1' }))
    const duplicate = makeContactData({ id: 'c1', playerId: 'p2', relationship: 'father' })

    expect(() => addContact(duplicate)).toThrow(ALREADY_EXISTS_PATTERN)
    expect(storeContacts).toHaveBeenCalledTimes(1)
  })

  it('add() throws for a missing playerId', () => {
    expect(() => addContact(makeContactData({ id: 'c1', playerId: '' }))).toThrow(MISSING_PLAYER_ID_PATTERN)
    expect(storeContacts).not.toHaveBeenCalled()
  })

  it('add() checks isRegisterable before the duplicate id check', () => {
    addContact(makeContactData({ id: 'c1', playerId: 'p1' }))
    const duplicateAndNotRegisterable = makeContactData({ id: 'c1', playerId: '', relationship: 'mother' })

    expect(() => addContact(duplicateAndNotRegisterable)).toThrow(NOT_REGISTERABLE_PATTERN)
    expect(() => addContact(duplicateAndNotRegisterable)).not.toThrow(ALREADY_EXISTS_PATTERN)
  })

  it('update() updates an existing contact and persists once', () => {
    addContact(makeContactData({ firstName: 'Marie', id: 'c1', playerId: 'p1' }))

    updateContact('c1', makeContactData({ firstName: 'Marie Updated', id: 'c1', playerId: 'p1' }))

    expect(getRawContacts()[0].firstName).toBe('Marie Updated')
    expect(storeContacts).toHaveBeenCalledTimes(2)
  })

  it('update() throws for a non-existent id without persisting', () => {
    expect(() => updateContact('ghost', makeContactData({ id: 'ghost' }))).toThrow(DOES_NOT_EXIST_PATTERN)
    expect(storeContacts).not.toHaveBeenCalled()
  })

  it('remove() removes the contact and persists once', () => {
    addContact(makeContactData())

    removeContact('c1')

    expect(getRawContacts()).toEqual([])
    expect(storeContacts).toHaveBeenCalledTimes(2)
  })

  it('remove() throws for a non-existent id without persisting', () => {
    expect(() => removeContact('ghost')).toThrow(DOES_NOT_EXIST_PATTERN)
    expect(storeContacts).not.toHaveBeenCalled()
  })

  it('getContactsByPlayerId() returns only matching contacts, cloned', () => {
    hydrateContacts([
      makeContactData({ id: 'c1', playerId: 'p1' }),
      makeContactData({ id: 'c2', playerId: 'p2', relationship: 'father' }),
      makeContactData({ id: 'c3', playerId: 'p1', relationship: 'other' }),
    ])

    expect(getContactsByPlayerId('p1').map((c) => c.id)).toEqual(['c1', 'c3'])
  })

  it('mutations compute a pure next array: stored objects are never mutated', () => {
    const raw = makeContactData({ firstName: 'Original' })
    hydrateContacts([raw])

    // Mutating the raw used for hydration must not affect the store.
    raw.firstName = 'Mutated input'
    expect(getRawContacts()[0].firstName).toBe('Original')

    // Mutating a value returned by the clone getter must not affect the store.
    const [retrieved] = getRawContacts()
    retrieved.firstName = 'Mutated read'
    expect(getRawContacts()[0].firstName).toBe('Original')

    // Mutating the input of add/update must not affect the stored object.
    const addedRaw = makeContactData({ id: 'c2', playerId: 'p1', relationship: 'other' })
    addContact(addedRaw)
    addedRaw.firstName = 'Mutated add'
    expect(getContactsByPlayerId('p1').find((c) => c.id === 'c2')?.firstName).toBeUndefined()
  })

  it('replacePlayerContacts() swaps only the target player contacts and persists exactly once', () => {
    hydrateContacts([
      makeContactData({ id: 'c-rep-9a', playerId: 'p-rep-9' }),
      makeContactData({ id: 'c-rep-9-other', playerId: 'p-rep-9-other' }),
    ])

    replacePlayerContacts('p-rep-9', [
      makeContactData({ firstName: 'Updated', id: 'c-rep-9a', playerId: 'p-rep-9' }),
      makeContactData({ id: 'c-rep-9b', playerId: 'p-rep-9' }),
    ])

    expect(getRawContacts().map((contact) => contact.id)).toEqual(['c-rep-9-other', 'c-rep-9a', 'c-rep-9b'])
    expect(getRawContacts().find((contact) => contact.id === 'c-rep-9a')?.firstName).toBe('Updated')
    expect(storeContacts).toHaveBeenCalledTimes(1)
  })

  it('assertContactExists() returns the matching contact or throws', () => {
    hydrateContacts([makeContactData({ id: 'c1', playerId: 'p1' })])

    expect(assertContactExists(getRawContacts(), 'c1').id).toBe('c1')
    expect(() => assertContactExists(getRawContacts(), 'ghost')).toThrow(DOES_NOT_EXIST_PATTERN)
  })
})
