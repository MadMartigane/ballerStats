import { describe, expect, it } from 'vitest'
import type { MatchClockData } from './clock.d'
import Match from './match'

describe('Match — championship field', () => {
  it('round-trip: championship survives getRawData', () => {
    const m = new Match({ championship: 'Coupe Hiver' })
    expect(m.championship).toBe('Coupe Hiver')
    expect(m.getRawData().championship).toBe('Coupe Hiver')
  })

  it('round-trip via constructor from raw data', () => {
    const raw = new Match({ championship: 'Test' }).getRawData()
    const m2 = new Match(raw)
    expect(m2.championship).toBe('Test')
  })

  it('empty string championship is preserved (not coerced to null)', () => {
    const m = new Match({ championship: '' })
    expect(m.championship).toBe('')
    expect(m.getRawData().championship).toBe('')
  })

  it('null championship is preserved', () => {
    const m = new Match({ championship: null })
    expect(m.championship).toBeNull()
    expect(m.getRawData().championship).toBeNull()
  })

  it('default championship is null when not provided', () => {
    const m = new Match({})
    expect(m.championship).toBeNull()
  })

  it('default championship is null with only opponent', () => {
    const m = new Match({ opponent: 'Test Team' })
    expect(m.championship).toBeNull()
  })

  it('update sets championship', () => {
    const m = new Match({})
    m.update({ championship: 'Nouveau' })
    expect(m.championship).toBe('Nouveau')
  })

  it('update with null clears championship', () => {
    const m = new Match({ championship: 'Old' })
    m.update({ championship: null })
    expect(m.championship).toBeNull()
  })

  it('old data without championship deserializes with null', () => {
    const raw = { id: 'abc', opponent: 'Team X' }
    const m = new Match(raw)
    expect(m.championship).toBeNull()
  })
})

describe('Match — matchFormat field', () => {
  const format = { periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 }

  it('round-trip: matchFormat survives getRawData as an independent copy', () => {
    const m = new Match({ matchFormat: format })
    const raw = m.getRawData()

    expect(raw.matchFormat).toEqual(format)
    expect(raw.matchFormat).not.toBe(format)
  })

  it('defaults to null when not provided', () => {
    expect(new Match({}).matchFormat).toBeNull()
    expect(new Match({}).getRawData().matchFormat).toBeUndefined()
  })

  it('update sets and clears matchFormat', () => {
    const m = new Match({})

    m.update({ matchFormat: format })
    expect(m.matchFormat).toEqual(format)

    m.update({ matchFormat: null })
    expect(m.matchFormat).toBeNull()
  })
})

describe('Match — clock and period fields', () => {
  const clock: MatchClockData = { anchorEpochMs: 0, remainingMs: 480_000, running: false }

  it('round-trip: clock survives getRawData as an independent copy', () => {
    const raw = new Match({ clock }).getRawData()

    expect(raw.clock).toEqual(clock)
    expect(raw.clock).not.toBe(clock)
  })

  it('round-trip: currentPeriod survives getRawData and constructor', () => {
    const raw = new Match({ currentPeriod: 2 }).getRawData()

    expect(raw.currentPeriod).toBe(2)
    expect(new Match(raw).currentPeriod).toBe(2)
  })

  it('legacy raw without clock fields yields null and loses no legacy field', () => {
    const legacy = { championship: 'Coupe', id: 'abc', opponent: 'Team X', stats: [] }
    const m = new Match(legacy)
    const raw = m.getRawData()

    expect(m.clock).toBeNull()
    expect(m.currentPeriod).toBeNull()
    expect(raw.clock).toBeUndefined()
    expect(raw.currentPeriod).toBeUndefined()
    expect(raw).toMatchObject({ championship: 'Coupe', id: 'abc', opponent: 'Team X' })
  })

  it('clone independence: mutating the returned clock does not mutate the instance', () => {
    const m = new Match({ clock })
    const raw = m.getRawData()

    if (raw.clock) {
      raw.clock.remainingMs = 1
    }

    expect(m.clock).toEqual(clock)
    expect(m.getRawData().clock?.remainingMs).toBe(480_000)
  })

  it('rejects an invalid clock payload and stores null', () => {
    const m = new Match({ clock: { anchorEpochMs: 0, remainingMs: -5, running: false } })

    expect(m.clock).toBeNull()
    expect(m.getRawData().clock).toBeUndefined()
  })

  it('update sets clock and currentPeriod', () => {
    const m = new Match({})

    m.update({ clock, currentPeriod: 3 })

    expect(m.getRawData()).toMatchObject({ clock, currentPeriod: 3 })
  })
})
