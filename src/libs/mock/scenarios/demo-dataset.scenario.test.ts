import { beforeEach, describe, expect, it } from 'vitest'
import { resetCounters as resetMockCounters } from '../mock-counter'
import { seedDemoDataset } from './demo-dataset.scenario'

describe('seedDemoDataset', () => {
  beforeEach(() => {
    resetMockCounters()
  })

  it('returns the expected counts', () => {
    const ds = seedDemoDataset()
    expect(ds.teams).toHaveLength(2)
    expect(ds.players).toHaveLength(10)
    expect(ds.matchs).toHaveLength(3)
    expect(ds.contacts).toHaveLength(2)
  })

  it('every entity is registerable', () => {
    const ds = seedDemoDataset()
    for (const p of ds.players) {
      expect(p.isRegisterable).toBe(true)
    }
    for (const t of ds.teams) {
      expect(t.isRegisterable).toBe(true)
    }
    for (const m of ds.matchs) {
      expect(m.isRegisterable).toBe(true)
    }
    for (const c of ds.contacts) {
      expect(c.isRegisterable).toBe(true)
    }
  })

  it('is deterministic across calls after resetMockCounters()', () => {
    resetMockCounters()
    const a = seedDemoDataset().players.map((p) => p.id)
    resetMockCounters()
    const b = seedDemoDataset().players.map((p) => p.id)
    expect(a).toEqual(b)
  })
})
