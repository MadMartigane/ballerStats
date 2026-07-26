import { describe, expect, it } from 'vitest'
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
