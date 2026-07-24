import { describe, expect, it } from 'vitest'
import { makeEmptyMatch, makePartialMatch } from './full-game.scenario'

describe('makeEmptyMatch', () => {
  it('produces a registerable match with zero stats', () => {
    const m = makeEmptyMatch('t1')
    expect(m.isRegisterable).toBe(true)
    expect(m.stats).toEqual([])
  })
})

describe('makePartialMatch', () => {
  it('produces a registerable match with some stats and unlocked status', () => {
    const m = makePartialMatch('t1', ['p1', 'p2', 'p3', 'p4', 'p5'])
    expect(m.isRegisterable).toBe(true)
    expect(m.status).toBe('unlocked')
    expect(m.stats.length).toBeGreaterThan(0)
  })

  it('throws when playerIds is empty', () => {
    expect(() => makePartialMatch('t1', [])).toThrow()
  })
})
