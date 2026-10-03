import { describe, expect, it } from 'vitest'
import type { MatchRawData } from '../match/match.d'
import {
  AGE_CATEGORY_PRESETS,
  buildMatchFormatConfig,
  DEFAULT_MATCH_FORMAT,
  formatMatchFormat,
  formatTheoreticalTotal,
  getMatchCeilingMinutes,
  getTheoreticalPlayerMinutes,
  isMatchFormatConfig,
  resolveMatchFormat,
  toTeamFormatPatch,
} from './match-format'
import type { TeamRawData } from './team.d'

const team = (overrides: TeamRawData): TeamRawData => overrides
const match = (overrides: MatchRawData): MatchRawData => overrides

describe('resolveMatchFormat — resolution order', () => {
  it('a valid match format wins over everything else', () => {
    const resolved = resolveMatchFormat(
      team({
        category: 'U13',
        matchFormat: { periodLengthMinutes: 7, periods: 4, playersOnCourt: 5 },
      }),
      match({ matchFormat: { periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 } })
    )

    expect(resolved).toEqual({ periodLengthMinutes: 8, periods: 4, playersOnCourt: 5, source: 'match-override' })
  })

  it('the match format wins even without a team', () => {
    const resolved = resolveMatchFormat(
      null,
      match({ matchFormat: { periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 } })
    )

    expect(resolved).toEqual({ periodLengthMinutes: 8, periods: 4, playersOnCourt: 5, source: 'match-override' })
  })

  it('a valid team default wins over the category preset when the match has none', () => {
    const resolved = resolveMatchFormat(
      team({
        category: 'U13',
        matchFormat: { periodLengthMinutes: 7, periods: 4, playersOnCourt: 5 },
      }),
      match({})
    )

    expect(resolved).toEqual({ periodLengthMinutes: 7, periods: 4, playersOnCourt: 5, source: 'team-default' })
  })

  it('uses the category preset when neither match nor team carries a format', () => {
    const resolved = resolveMatchFormat(team({ category: 'U11' }), match({}))

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

  it('an invalid team override falls through to the category preset', () => {
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

  it('a corrupted match format falls through to the team default', () => {
    const resolved = resolveMatchFormat(
      team({ category: 'U13', matchFormat: { periodLengthMinutes: 7, periods: 4, playersOnCourt: 5 } }),
      match({ matchFormat: { periodLengthMinutes: -1, periods: 4, playersOnCourt: 5 } })
    )

    expect(resolved).toEqual({ periodLengthMinutes: 7, periods: 4, playersOnCourt: 5, source: 'team-default' })
  })

  it('a corrupted match format falls through to the category preset when the team has no default', () => {
    const resolved = resolveMatchFormat(
      team({ category: 'U13' }),
      match({ matchFormat: { periodLengthMinutes: 8, periods: '4' as never, playersOnCourt: 5 } })
    )

    expect(resolved).toEqual({ ...AGE_CATEGORY_PRESETS.U13, source: 'category-preset' })
  })

  it('a corrupted match format falls all the way to the default', () => {
    const resolved = resolveMatchFormat(
      null,
      match({ matchFormat: { periodLengthMinutes: 8, periods: null as never, playersOnCourt: 5 } })
    )

    expect(resolved).toEqual({ ...DEFAULT_MATCH_FORMAT, source: 'default' })
  })

  it('a null match format is ignored', () => {
    const resolved = resolveMatchFormat(team({ category: 'U9' }), match({ matchFormat: null }))

    expect(resolved.source).toBe('category-preset')
  })
})

describe('toTeamFormatPatch — team select of the match form', () => {
  const teamDefault: TeamRawData = {
    category: 'U13',
    matchFormat: { periodLengthMinutes: 7, periods: 4, playersOnCourt: 5 },
  }

  it('copies the selected team default when the team carries one', () => {
    expect(toTeamFormatPatch(teamDefault)).toEqual({
      matchFormat: { periodLengthMinutes: 7, periods: 4, playersOnCourt: 5 },
    })
  })

  it('returns a null matchFormat for a team without a default', () => {
    expect(toTeamFormatPatch(team({ category: 'U13' }))).toEqual({ matchFormat: null })
  })

  it('returns a null matchFormat for an unknown team', () => {
    expect(toTeamFormatPatch(null)).toEqual({ matchFormat: null })
  })

  it('the copied team format is a clone: mutating the team raw cannot reach the patch', () => {
    const teamFormat = { periodLengthMinutes: 7, periods: 4, playersOnCourt: 5 }
    const mutableTeam: TeamRawData = { category: 'U13', matchFormat: teamFormat }

    const patch = toTeamFormatPatch(mutableTeam)
    teamFormat.periodLengthMinutes = 99

    expect(patch.matchFormat?.periodLengthMinutes).toBe(7)
  })
})

describe('formatMatchFormat', () => {
  it('describes the format as periods x minutes x players', () => {
    expect(formatMatchFormat({ periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 })).toBe(
      '4 périodes × 8 min × 5 joueurs'
    )
  })

  it('uses the senior default wording', () => {
    expect(formatMatchFormat(DEFAULT_MATCH_FORMAT)).toBe('4 périodes × 10 min × 5 joueurs')
  })
})

describe('formatTheoreticalTotal', () => {
  it('multiplies periods, period length and players on court', () => {
    expect(formatTheoreticalTotal({ periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 })).toBe(
      '160 min de jeu théoriques'
    )
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

  it('rejects fractional counts, which both entry UIs forbid', () => {
    expect(isMatchFormatConfig({ periodLengthMinutes: 8, periods: 4.5, playersOnCourt: 5 })).toBe(false)
    expect(isMatchFormatConfig({ periodLengthMinutes: 8.5, periods: 4, playersOnCourt: 5 })).toBe(false)
    expect(isMatchFormatConfig({ periodLengthMinutes: 8, periods: 4, playersOnCourt: 2.5 })).toBe(false)
  })
})

describe('buildMatchFormatConfig', () => {
  it('builds a config from three positive-integer texts', () => {
    expect(buildMatchFormatConfig('4', '8', '5')).toEqual({ periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 })
  })

  it('returns null when a field is empty, zero, negative or fractional', () => {
    expect(buildMatchFormatConfig('', '8', '5')).toBeNull()
    expect(buildMatchFormatConfig('0', '8', '5')).toBeNull()
    expect(buildMatchFormatConfig('-4', '8', '5')).toBeNull()
    expect(buildMatchFormatConfig('4', '8.5', '5')).toBeNull()
    expect(buildMatchFormatConfig('4', '8', 'quatre')).toBeNull()
  })
})
