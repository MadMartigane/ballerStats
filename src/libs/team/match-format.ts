import type { TeamRawData } from './team.d'

export interface MatchFormatConfig {
  periodLengthMinutes: number
  periods: number
  playersOnCourt: number
}

export type AgeCategory = 'U7' | 'U9' | 'U11' | 'U13' | 'U15' | 'U17' | 'U19' | 'senior'

export interface ResolvedMatchFormat extends MatchFormatConfig {
  source: 'team-override' | 'category-preset' | 'default'
}

/** FFBB national rule: seniors 4 x 10. Fallback for teams without category. */
export const DEFAULT_MATCH_FORMAT: MatchFormatConfig = {
  periodLengthMinutes: 10,
  periods: 4,
  playersOnCourt: 5,
}

/** Committee-tweakable starting points; every field remains overridable per team. */
export const AGE_CATEGORY_PRESETS: Readonly<Record<AgeCategory, MatchFormatConfig>> = {
  senior: { periodLengthMinutes: 10, periods: 4, playersOnCourt: 5 },
  U7: { periodLengthMinutes: 6, periods: 4, playersOnCourt: 5 },
  U9: { periodLengthMinutes: 6, periods: 4, playersOnCourt: 5 },
  U11: { periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 },
  U13: { periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 },
  U15: { periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 },
  U17: { periodLengthMinutes: 10, periods: 4, playersOnCourt: 5 },
  U19: { periodLengthMinutes: 10, periods: 4, playersOnCourt: 5 },
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** Structural guard used to validate a team's raw format override. */
export function isMatchFormatConfig(value: unknown): value is MatchFormatConfig {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    isFinitePositive(candidate.periods) &&
    isFinitePositive(candidate.periodLengthMinutes) &&
    isFinitePositive(candidate.playersOnCourt)
  )
}

/**
 * Resolve the effective match format for a team: explicit override first,
 * then the age-category preset, then the senior default.
 */
export function resolveMatchFormat(team: TeamRawData | null): ResolvedMatchFormat {
  if (team && isMatchFormatConfig(team.matchFormat)) {
    return { ...team.matchFormat, source: 'team-override' }
  }

  const preset = team?.category ? AGE_CATEGORY_PRESETS[team.category] : undefined
  if (preset) {
    return { ...preset, source: 'category-preset' }
  }

  return { ...DEFAULT_MATCH_FORMAT, source: 'default' }
}

/** Physical maximum for a single player: periods * period length. */
export function getMatchCeilingMinutes(format: MatchFormatConfig): number {
  return format.periods * format.periodLengthMinutes
}

/** Total minutes of play distributed across the players on court. */
export function getTheoreticalPlayerMinutes(format: MatchFormatConfig): number {
  return getMatchCeilingMinutes(format) * format.playersOnCourt
}
