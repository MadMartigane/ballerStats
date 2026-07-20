import { beforeEach, describe, expect, it } from 'vitest'
import { TEAM_OPPONENT_ID } from '../../team/team'
import { resetCounters as resetMockCounters } from '../mock-counter'
import { makeEmptyMatch, makeFullGameMatch, makePartialMatch } from './full-game.scenario'

describe('makeFullGameMatch', () => {
  beforeEach(() => {
    resetMockCounters()
  })

  it('produces a registerable, locked match with non-empty stats', () => {
    const m = makeFullGameMatch('t1', ['p1', 'p2', 'p3', 'p4', 'p5'])
    expect(m.isRegisterable).toBe(true)
    expect(m.status).toBe('locked')
    expect(m.stats.length).toBeGreaterThan(0)
  })

  it('includes both team and opponent stats', () => {
    const m = makeFullGameMatch('t1', ['p1'])
    expect(m.stats.some((s) => s.playerId === TEAM_OPPONENT_ID)).toBe(true)
    expect(m.stats.some((s) => s.playerId === 'p1')).toBe(true)
  })

  it('throws when playerIds is empty', () => {
    expect(() => makeFullGameMatch('t1', [])).toThrow()
  })
})

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
