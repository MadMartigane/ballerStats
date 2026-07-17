import { beforeEach, describe, expect, it } from 'vitest'
import { resetCounters as resetMockCounters } from '../mock-counter'
import { makeContact } from './contact.factory'

describe('makeContact', () => {
  beforeEach(() => {
    resetMockCounters()
  })

  it('produces a registerable contact with default values', () => {
    const contact = makeContact()
    expect(contact.isRegisterable).toBe(true)
    expect(contact.playerId).toBe('mock-player-1')
    expect(contact.relationship).toBe('other')
  })

  it('honours explicit id override', () => {
    expect(makeContact({ id: 'c1' }).id).toBe('c1')
  })

  it('accepts valid relationship override', () => {
    const contact = makeContact({ relationship: 'mother' })
    expect(contact.relationship).toBe('mother')
  })
})
