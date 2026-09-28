import { describe, expect, it } from 'vitest'
import {
  AGE_CATEGORY_PRESETS,
  DEFAULT_MATCH_FORMAT,
  getMatchCeilingMinutes,
  getTheoreticalPlayerMinutes,
  isMatchFormatConfig,
  resolveMatchFormat,
} from './match-format'
import type { TeamRawData } from './team.d'

const team = (overrides: TeamRawData): TeamRawData => overrides

describe('resolveMatchFormat — resolution order', () => {
  it('a valid team override wins over the category preset', () => {
    const resolved = resolveMatchFormat(
      team({
        category: 'U13',
        matchFormat: { periodLengthMinutes: 7, periods: 4, playersOnCourt: 5 },
      })
    )

    expect(resolved).toEqual({ periodLengthMinutes: 7, periods: 4, playersOnCourt: 5, source: 'team-override' })
  })

  it('uses the category preset when there is no override', () => {
    const resolved = resolveMatchFormat(team({ category: 'U11' }))

    expect(resolved).toEqual({ ...AGE_CATEGORY_PRESETS.U11, source: 'category-preset' })
  })

  it('falls back to the default when the team is null', () => {
    expect(resolveMatchFormat(null)).toEqual({ ...DEFAULT_MATCH_FORMAT, source: 'default' })
  })

  it('falls back to the default when the category is absent', () => {
    expect(resolveMatchFormat(team({ name: 'No category' }))).toEqual({
      ...DEFAULT_MATCH_FORMAT,
      source: 'default',
    })
  })

  it('falls back to the default for an unknown category string', () => {
    const resolved = resolveMatchFormat(team({ category: 'U42' as never }))

    expect(resolved).toEqual({ ...DEFAULT_MATCH_FORMAT, source: 'default' })
  })

  it('an invalid override falls through to the category preset', () => {
    const resolved = resolveMatchFormat(
      team({
        category: 'U15',
        matchFormat: { periodLengthMinutes: 0, periods: 4, playersOnCourt: 5 },
      })
    )

    expect(resolved).toEqual({ ...AGE_CATEGORY_PRESETS.U15, source: 'category-preset' })
  })

  it('an invalid override without a category falls through to the default', () => {
    const resolved = resolveMatchFormat(
      team({ matchFormat: { periodLengthMinutes: Number.NaN, periods: 4, playersOnCourt: 5 } })
    )

    expect(resolved).toEqual({ ...DEFAULT_MATCH_FORMAT, source: 'default' })
  })

  it('a null override is ignored', () => {
    const resolved = resolveMatchFormat(team({ category: 'U9', matchFormat: null }))

    expect(resolved.source).toBe('category-preset')
  })
})

describe('arithmetic helpers', () => {
  it('4 x 7 x 5 -> ceiling 28, theoretical 140', () => {
    const format = { periodLengthMinutes: 7, periods: 4, playersOnCourt: 5 }

    expect(getMatchCeilingMinutes(format)).toBe(28)
    expect(getTheoreticalPlayerMinutes(format)).toBe(140)
  })

  it('4 x 10 x 5 -> ceiling 40, theoretical 200', () => {
    expect(getMatchCeilingMinutes(DEFAULT_MATCH_FORMAT)).toBe(40)
    expect(getTheoreticalPlayerMinutes(DEFAULT_MATCH_FORMAT)).toBe(200)
  })
})

describe('isMatchFormatConfig', () => {
  it('accepts a valid config', () => {
    expect(isMatchFormatConfig({ periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 })).toBe(true)
  })

  it('rejects null and undefined', () => {
    expect(isMatchFormatConfig(null)).toBe(false)
    expect(isMatchFormatConfig(undefined)).toBe(false)
  })

  it('rejects arrays and strings', () => {
    expect(isMatchFormatConfig([4, 8, 5])).toBe(false)
    expect(isMatchFormatConfig('4x8')).toBe(false)
  })

  it('rejects objects with missing fields', () => {
    expect(isMatchFormatConfig({ periods: 4 })).toBe(false)
    expect(isMatchFormatConfig({})).toBe(false)
  })

  it('rejects non-finite, negative and zero values', () => {
    expect(isMatchFormatConfig({ periodLengthMinutes: 8, periods: Number.NaN, playersOnCourt: 5 })).toBe(false)
    expect(isMatchFormatConfig({ periodLengthMinutes: 8, periods: -4, playersOnCourt: 5 })).toBe(false)
    expect(isMatchFormatConfig({ periodLengthMinutes: 0, periods: 4, playersOnCourt: 0 })).toBe(false)
    expect(isMatchFormatConfig({ periodLengthMinutes: Number.POSITIVE_INFINITY, periods: 4, playersOnCourt: 5 })).toBe(
      false
    )
  })
})
