import { beforeEach, describe, expect, it } from 'vitest'
import { resetCounters as resetMockCounters } from '../mock-counter'
import { makePlayer } from './player.factory'

describe('makePlayer', () => {
  beforeEach(() => {
    resetMockCounters()
  })

  it('produces a registerable player with default values', () => {
    const player = makePlayer()
    expect(player.isRegisterable).toBe(true)
    expect(player.firstName).toBe('Player')
    expect(player.jerseyNumber).toBe('0')
  })

  it('honours explicit id override', () => {
    expect(makePlayer({ id: 'p1' }).id).toBe('p1')
  })

  it('generates unique monotonic ids across calls', () => {
    const a = makePlayer().id
    const b = makePlayer().id
    expect(a).not.toBe(b)
  })

  it('round-trips overrides through getRawData()', () => {
    const raw = makePlayer({ firstName: 'Alice', lastName: 'Bob', jerseyNumber: '23' }).getRawData()
    expect(raw.firstName).toBe('Alice')
    expect(raw.lastName).toBe('Bob')
    expect(raw.jerseyNumber).toBe('23')
  })
})
