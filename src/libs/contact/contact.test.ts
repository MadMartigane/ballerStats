import { describe, expect, it } from 'vitest'
import Contact, { getRelationshipLabel, isContactRelationship } from './contact'
import type { ContactRawData } from './contact.d'

describe('Contact', () => {
  it('round-trips all fields through getRawData() including optional ones', () => {
    const raw: ContactRawData = {
      id: 'contact-1',
      playerId: 'player-1',
      firstName: 'Marie',
      lastName: 'Curie',
      phone: '+1234567890',
      email: 'marie@example.com',
      address: '1 Rue Pierre',
      relationship: 'mother',
    }

    const contact = new Contact(raw)
    expect(contact.getRawData()).toEqual(raw)
  })

  it('auto-generates a truthy id when missing', () => {
    const contact = new Contact({ playerId: 'player-1', relationship: 'father' })
    expect(contact.id).toBeTruthy()
    expect(typeof contact.id).toBe('string')
  })

  it('falls back to "other" when relationship is missing', () => {
    const contact = new Contact({ playerId: 'player-1', relationship: undefined } as unknown as ContactRawData)
    expect(contact.relationship).toBe('other')
  })

  it('falls back to "other" when relationship is invalid', () => {
    const contact = new Contact({ playerId: 'player-1', relationship: 'invalid' as ContactRawData['relationship'] })
    expect(contact.relationship).toBe('other')
  })

  it('does not throw for an invalid relationship', () => {
    expect(
      () => new Contact({ playerId: 'player-1', relationship: 'cousin' as ContactRawData['relationship'] })
    ).not.toThrow()
  })

  it('update() merges partial data without losing other fields', () => {
    const contact = new Contact({
      id: 'contact-1',
      playerId: 'player-1',
      firstName: 'Marie',
      lastName: 'Curie',
      email: 'marie@example.com',
      relationship: 'mother',
    })

    contact.update({ email: 'marie.new@example.com' })

    const raw = contact.getRawData()
    expect(raw.email).toBe('marie.new@example.com')
    expect(raw.firstName).toBe('Marie')
    expect(raw.lastName).toBe('Curie')
    expect(raw.relationship).toBe('mother')
    expect(raw.playerId).toBe('player-1')
  })

  it('setFromRawData() overwrites playerId unconditionally (empty value wins over existing)', () => {
    const contact = new Contact({ id: 'contact-1', playerId: 'player-1', relationship: 'mother' })

    contact.setFromRawData({ id: 'contact-1', playerId: '', relationship: 'mother' })

    expect(contact.playerId).toBe('')
  })

  it('omits optional fields from getRawData() when unset', () => {
    const contact = new Contact({ id: 'contact-1', playerId: 'player-1', relationship: 'other' })

    const raw = contact.getRawData()
    expect(raw).not.toHaveProperty('firstName')
    expect(raw).not.toHaveProperty('lastName')
    expect(raw).not.toHaveProperty('phone')
    expect(raw).not.toHaveProperty('email')
    expect(raw).not.toHaveProperty('address')
  })

  it('creates a valid Contact with defaults when no data is provided', () => {
    const contact = new Contact()

    expect(contact.id).toBeTruthy()
    expect(typeof contact.id).toBe('string')
    expect(contact.playerId).toBe('')
    expect(contact.relationship).toBe('other')
    expect(contact.firstName).toBeUndefined()
    expect(contact.lastName).toBeUndefined()
    expect(contact.getRawData()).toEqual({ id: contact.id, playerId: '', relationship: 'other' })
  })

  it('isRegisterable is true only when a playerId is set', () => {
    const registerable = new Contact({ playerId: 'player-1', relationship: 'mother' })
    expect(registerable.isRegisterable).toBe(true)

    const empty = new Contact({ playerId: '', relationship: 'mother' })
    expect(empty.isRegisterable).toBe(false)

    const defaults = new Contact()
    expect(defaults.isRegisterable).toBe(false)
  })

  it('isContactRelationship() returns true only for valid relationship strings', () => {
    expect(isContactRelationship('mother')).toBe(true)
    expect(isContactRelationship('father')).toBe(true)
    expect(isContactRelationship('other')).toBe(true)
    expect(isContactRelationship('invalid')).toBe(false)
  })

  it('isContactRelationship() returns false for non-string values without throwing', () => {
    expect(isContactRelationship(undefined)).toBe(false)
    expect(isContactRelationship(null)).toBe(false)
    expect(isContactRelationship(42)).toBe(false)
    expect(isContactRelationship({ value: 'mother' })).toBe(false)
    expect(() => isContactRelationship(undefined)).not.toThrow()
  })

  it('getRelationshipLabel() returns the French label for a known relationship', () => {
    expect(getRelationshipLabel('mother')).toBe('Mère')
    expect(getRelationshipLabel('father')).toBe('Père')
    expect(getRelationshipLabel('other')).toBe('Autre')
  })
})
