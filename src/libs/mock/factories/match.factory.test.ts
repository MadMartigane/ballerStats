import { beforeEach, describe, expect, it } from 'vitest'
import { resetCounters as resetMockCounters } from '../mock-counter'
import { makeMatch } from './match.factory'
import { makeStatEntry } from './stat-entry.factory'

describe('makeMatch', () => {
  beforeEach(() => {
    resetMockCounters()
  })

  it('produces a registerable match with default values', () => {
    const match = makeMatch()
    expect(match.isRegisterable).toBe(true)
    expect(match.opponent).toBe('Mock Opponent')
    expect(match.type).toBe('home')
    expect(match.teamId).toBe('mock-team-1')
  })

  it('honours explicit id override', () => {
    expect(makeMatch({ id: 'm1' }).id).toBe('m1')
  })

  it('accepts stats override', () => {
    const match = makeMatch({ stats: [makeStatEntry('2pts')] })
    expect(match.stats.length).toBe(1)
  })

  it('default stats is empty array', () => {
    expect(makeMatch().stats).toEqual([])
  })
})
