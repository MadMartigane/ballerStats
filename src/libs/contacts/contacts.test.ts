import { describe, expect, it, vi } from 'vitest'
import Contact from '../contact'
import type { ContactRawData } from '../contact/contact.d'
import bsEventBus from '../event-bus'
import Contacts from './contacts'

const ALREADY_EXISTS_PATTERN = /already exists/
const MISSING_PLAYER_ID_PATTERN = /playerId/
const NOT_REGISTERABLE_PATTERN = /not registerable/
const DOES_NOT_EXIST_PATTERN = /doesn't exist/
const NOT_FOUND_PATTERN = /not found/

function makeContactData(overrides: Partial<ContactRawData> = {}): ContactRawData {
  return {
    id: 'c1',
    playerId: 'p1',
    relationship: 'mother',
    ...overrides,
  }
}

describe('Contacts', () => {
  it('add() stores the contact and makes it retrievable', () => {
    const contacts = new Contacts()
    const contact = new Contact(makeContactData())

    contacts.add(contact)

    expect(contacts.length).toBe(1)
    expect(contacts.contacts[0].id).toBe('c1')
  })

  it('add() throws for a duplicate id', () => {
    const contacts = new Contacts()
    contacts.add(new Contact(makeContactData({ id: 'c1', playerId: 'p1' })))
    const duplicate = new Contact(makeContactData({ id: 'c1', playerId: 'p2', relationship: 'father' }))

    expect(() => contacts.add(duplicate)).toThrow(ALREADY_EXISTS_PATTERN)
  })

  it('add() throws for a missing playerId', () => {
    const contacts = new Contacts()
    const contact = new Contact(makeContactData({ id: 'c1', playerId: '', relationship: 'mother' }))

    expect(() => contacts.add(contact)).toThrow(MISSING_PLAYER_ID_PATTERN)
  })

  it('add() checks isRegisterable before the duplicate id check', () => {
    const contacts = new Contacts()
    contacts.add(new Contact(makeContactData({ id: 'c1', playerId: 'p1' })))

    const duplicateAndNotRegisterable = new Contact(makeContactData({ id: 'c1', playerId: '', relationship: 'mother' }))

    expect(() => contacts.add(duplicateAndNotRegisterable)).toThrow(NOT_REGISTERABLE_PATTERN)
    expect(() => contacts.add(duplicateAndNotRegisterable)).not.toThrow(ALREADY_EXISTS_PATTERN)
  })

  it('updateContact() updates an existing contact', () => {
    const contacts = new Contacts()
    contacts.add(new Contact(makeContactData({ id: 'c1', playerId: 'p1', firstName: 'Marie' })))

    contacts.updateContact(new Contact(makeContactData({ id: 'c1', playerId: 'p1', firstName: 'Marie Updated' })))

    expect(contacts.contacts[0].firstName).toBe('Marie Updated')
  })

  it('updateContact() throws for a non-existent id', () => {
    const contacts = new Contacts()
    const ghost = new Contact(makeContactData({ id: 'ghost' }))

    expect(() => contacts.updateContact(ghost)).toThrow(DOES_NOT_EXIST_PATTERN)
  })

  it('remove() removes the contact from the collection', () => {
    const contacts = new Contacts()
    const contact = new Contact(makeContactData({ id: 'c1', playerId: 'p1' }))
    contacts.add(contact)

    contacts.remove(contact)

    expect(contacts.length).toBe(0)
    expect(contacts.contacts).toEqual([])
  })

  it('remove() throws for a non-existent id', () => {
    const contacts = new Contacts()
    const ghost = new Contact(makeContactData({ id: 'ghost' }))

    expect(() => contacts.remove(ghost)).toThrow(NOT_FOUND_PATTERN)
  })

  it('removeSilent() removes the contact from the collection', () => {
    const contacts = new Contacts()
    const contact = new Contact(makeContactData({ id: 'c1', playerId: 'p1' }))
    contacts.add(contact)

    contacts.removeSilent(contact)

    expect(contacts.length).toBe(0)
    expect(contacts.contacts).toEqual([])
  })

  it('removeSilent() throws for a non-existent id', () => {
    const contacts = new Contacts()
    const ghost = new Contact(makeContactData({ id: 'ghost' }))

    expect(() => contacts.removeSilent(ghost)).toThrow(NOT_FOUND_PATTERN)
  })

  it('removeSilent() does not fire a change event', () => {
    const contacts = new Contacts()
    const contact = new Contact(makeContactData({ id: 'c1', playerId: 'p1' }))
    contacts.add(contact)

    const handler = vi.fn()
    bsEventBus.addEventListener('BS::CONTACTS::CHANGE', handler)

    contacts.removeSilent(contact)

    expect(handler).not.toHaveBeenCalled()

    bsEventBus.removeEventListener('BS::CONTACTS::CHANGE', handler)
  })

  it('getByPlayerId() returns only matching contacts', () => {
    const contacts = new Contacts([
      makeContactData({ id: 'c1', playerId: 'p1' }),
      makeContactData({ id: 'c2', playerId: 'p2', relationship: 'father' }),
      makeContactData({ id: 'c3', playerId: 'p1', relationship: 'other' }),
    ])

    const matches = contacts.getByPlayerId('p1')

    expect(matches).toHaveLength(2)
    expect(matches.map((c) => c.id)).toEqual(['c1', 'c3'])
  })

  it('contacts getter returns deep clones (mutating returned contacts does not affect internal state)', () => {
    const contacts = new Contacts()
    contacts.add(new Contact(makeContactData({ id: 'c1', playerId: 'p1', firstName: 'Original' })))

    const retrieved = contacts.contacts[0]
    retrieved.update({ firstName: 'Mutated' })

    expect(contacts.contacts[0].firstName).toBe('Original')
  })

  it('setFromRawData() replaces the entire collection', () => {
    const contacts = new Contacts([makeContactData({ id: 'c1', playerId: 'p1' })])

    contacts.setFromRawData([
      makeContactData({ id: 'c2', playerId: 'p2', relationship: 'father' }),
      makeContactData({ id: 'c3', playerId: 'p3', relationship: 'other' }),
    ])

    expect(contacts.length).toBe(2)
    expect(contacts.contacts.map((c) => c.id)).toEqual(['c2', 'c3'])
  })

  it('setFromRawData(null) empties the collection', () => {
    const contacts = new Contacts([makeContactData({ id: 'c1', playerId: 'p1' })])
    expect(contacts.length).toBe(1)

    contacts.setFromRawData(null as unknown as ContactRawData[])

    expect(contacts.length).toBe(0)
    expect(contacts.contacts).toEqual([])
  })
})
