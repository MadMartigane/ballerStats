import { describe, expect, it } from 'vitest'
import Player from './player'

describe('Player — timestamps', () => {
  it('promotes legacy data (id, no timestamps) to updatedAt = 0 and deletedAt = null', () => {
    const player = new Player({ firstName: 'Old', id: 'legacy-1' })
    expect(player.updatedAt).toBe(0)
    expect(player.deletedAt).toBeNull()
  })

  it('stamps new records (no id in input) with updatedAt = Date.now()', () => {
    const before = Date.now()
    const player = new Player({ firstName: 'New' })
    expect(player.updatedAt).toBeGreaterThanOrEqual(before)
    expect(player.deletedAt).toBeNull()
  })

  it('keeps provided timestamps from raw data', () => {
    const player = new Player({ deletedAt: 5000, firstName: 'X', id: 'p1', updatedAt: 1000 })
    expect(player.updatedAt).toBe(1000)
    expect(player.deletedAt).toBe(5000)
  })

  it('getRawData always includes updatedAt and deletedAt', () => {
    const player = new Player({ id: 'p1' })
    expect(player.getRawData()).toMatchObject({ deletedAt: null, updatedAt: 0 })
  })

  it('update() stamps updatedAt as mutated', () => {
    const player = new Player({ firstName: 'A', id: 'p1' })
    expect(player.updatedAt).toBe(0)

    player.update({ lastName: 'B' })
    expect(player.updatedAt).toBeGreaterThan(0)
  })

  it('markAsDeleted() sets a deletedAt tombstone and stamps updatedAt', () => {
    const player = new Player({ firstName: 'A', id: 'p1' })

    player.markAsDeleted()

    expect(player.deletedAt).not.toBeNull()
    expect(player.updatedAt).toBeGreaterThan(0)
    expect(player.getRawData().deletedAt).toBe(player.deletedAt)
  })
})
