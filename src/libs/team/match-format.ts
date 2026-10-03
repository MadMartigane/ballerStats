import type { MatchRawData } from '../match/match.d'
import type { TeamRawData } from './team.d'

export interface MatchFormatConfig {
  periodLengthMinutes: number
  periods: number
  playersOnCourt: number
}

export type AgeCategory = 'U7' | 'U9' | 'U11' | 'U13' | 'U15' | 'U17' | 'U19' | 'senior'

export interface ResolvedMatchFormat extends MatchFormatConfig {
  source: 'match-override' | 'team-default' | 'category-preset' | 'default'
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
  return typeof value === 'number' && Number.isInteger(value) && value > 0
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
 * Resolve the effective match format: the match's own value first, then the
 * team default, then the age-category preset, then the senior fallback.
 *
 * The format is a property of the match (a club plays 4×8 in league, 2×12 at a
 * tournament), so all four levels belong to one rule.
 */
export function resolveMatchFormat(team: TeamRawData | null, match?: MatchRawData | null): ResolvedMatchFormat {
  if (match && isMatchFormatConfig(match.matchFormat)) {
    return { ...match.matchFormat, source: 'match-override' }
  }

  if (team && isMatchFormatConfig(team.matchFormat)) {
    return { ...team.matchFormat, source: 'team-default' }
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

/** `4 périodes × 8 min × 5 joueurs`. */
export function formatMatchFormat(config: MatchFormatConfig): string {
  return `${config.periods} périodes × ${config.periodLengthMinutes} min × ${config.playersOnCourt} joueurs`
}

/** `160 min de jeu théoriques`. */
export function formatTheoreticalTotal(config: MatchFormatConfig): string {
  return `${getTheoreticalPlayerMinutes(config)} min de jeu théoriques`
}

const POSITIVE_INTEGER_PATTERN = /^\d+$/

function parsePositiveInteger(text: string): number | null {
  if (!POSITIVE_INTEGER_PATTERN.test(text)) {
    return null
  }

  const value = Number(text)
  return value > 0 ? value : null
}

/**
 * Build a format from three raw texts, or null when any field is not a
 * positive integer. Shared by the two entry UIs (match line, team default form).
 */
export function buildMatchFormatConfig(
  periodsText: string,
  periodLengthText: string,
  playersOnCourtText: string
): MatchFormatConfig | null {
  const periods = parsePositiveInteger(periodsText)
  const periodLengthMinutes = parsePositiveInteger(periodLengthText)
  const playersOnCourt = parsePositiveInteger(playersOnCourtText)

  if (periods === null || periodLengthMinutes === null || playersOnCourt === null) {
    return null
  }

  return { periodLengthMinutes, periods, playersOnCourt }
}

/**
 * A team's format as a match's format, copied so the match owns its own value;
 * null when the team carries no format.
 */
export function toTeamFormatPatch(team: TeamRawData | null): Pick<MatchRawData, 'matchFormat'> {
  return { matchFormat: team?.matchFormat ? { ...team.matchFormat } : null }
}
