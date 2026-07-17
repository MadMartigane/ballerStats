import { beforeEach, describe, expect, it } from 'vitest'
import { resetCounters as resetMockCounters } from '../mock-counter'
import { makeTeam } from './team.factory'

describe('makeTeam', () => {
  beforeEach(() => {
    resetMockCounters()
  })

  it('produces a registerable team with default values', () => {
    const team = makeTeam()
    expect(team.isRegisterable).toBe(true)
    expect(team.name).toBe('Mock Team')
    expect(team.playerIds).toEqual([])
  })

  it('honours explicit id override', () => {
    expect(makeTeam({ id: 't1' }).id).toBe('t1')
  })

  it('preserves playerIds override', () => {
    const team = makeTeam({ playerIds: ['a', 'b'] })
    expect(team.playerIds).toEqual(['a', 'b'])
  })

  it('generates unique monotonic ids across calls', () => {
    const a = makeTeam().id
    const b = makeTeam().id
    expect(a).not.toBe(b)
  })
})
