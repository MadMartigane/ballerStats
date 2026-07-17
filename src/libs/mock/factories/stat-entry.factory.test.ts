import { beforeEach, describe, expect, it } from 'vitest'
import { resetCounters as resetMockCounters } from '../mock-counter'
import { MOCK_BASE_TIMESTAMP, makeStatEntry } from './stat-entry.factory'

describe('makeStatEntry', () => {
  beforeEach(() => {
    resetMockCounters()
  })

  it('returns default value and type for 2pts success', () => {
    const entry = makeStatEntry('2pts')
    expect(entry.value).toBe(2)
    expect(entry.type).toBe('success')
  })

  it('returns 0 for 2pts error', () => {
    const entry = makeStatEntry('2pts', { type: 'error' })
    expect(entry.value).toBe(0)
    expect(entry.type).toBe('error')
  })

  it('returns 3 for 3pts success', () => {
    const entry = makeStatEntry('3pts')
    expect(entry.value).toBe(3)
    expect(entry.type).toBe('success')
  })

  it('honours explicit value override', () => {
    const entry = makeStatEntry('3pts', { value: 99 })
    expect(entry.value).toBe(99)
  })

  it('defaults playerId to null', () => {
    expect(makeStatEntry('2pts').playerId).toBeNull()
  })

  it('defaults timestamp to MOCK_BASE_TIMESTAMP', () => {
    expect(makeStatEntry('2pts').timestamp).toBe(MOCK_BASE_TIMESTAMP)
  })

  it('honours playerId override', () => {
    expect(makeStatEntry('2pts', { playerId: 'p1' }).playerId).toBe('p1')
  })
})
