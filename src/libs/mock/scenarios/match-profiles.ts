import type { StatMatchActionItemName } from '../../stats/stats.d'
import { STAT_ACTION_DEFAULTS } from '../../stats/stats-action-values'

// --- Types ---

export interface StatProfile {
  assists: number
  blocks: number
  defReb: number
  fouls: number
  ftMade: number
  ftMiss: number
  offReb: number
  steals: number
  threePtMade: number
  threePtMiss: number
  turnovers: number
  twoPtMade: number
  twoPtMiss: number
}

export interface StatFieldSpec {
  field: keyof StatProfile
  statName: StatMatchActionItemName
  statType: 'success' | 'error' | 'secondary'
}

export interface ScenarioTarget {
  opponent: number
  team: number
}

export interface MatchScenarioConfig {
  opponent: StatProfile
  profiles: readonly StatProfile[]
}

// --- Stat-field mapping (single table for both scoring and stat emission) ---

export const STAT_FIELD_SPECS: readonly StatFieldSpec[] = [
  { field: 'twoPtMade', statName: '2pts', statType: 'success' },
  { field: 'twoPtMiss', statName: '2pts', statType: 'error' },
  { field: 'threePtMade', statName: '3pts', statType: 'success' },
  { field: 'threePtMiss', statName: '3pts', statType: 'error' },
  { field: 'ftMade', statName: 'free-throw', statType: 'success' },
  { field: 'ftMiss', statName: 'free-throw', statType: 'error' },
  { field: 'offReb', statName: 'offensive-rebond', statType: 'success' },
  { field: 'defReb', statName: 'defensive-rebond', statType: 'secondary' },
  { field: 'assists', statName: 'assist', statType: 'success' },
  { field: 'steals', statName: 'steals', statType: 'success' },
  { field: 'blocks', statName: 'block', statType: 'success' },
  { field: 'turnovers', statName: 'turnover', statType: 'error' },
  { field: 'fouls', statName: 'foul', statType: 'error' },
]

// --- Pure helpers ---

/** Look up the canonical value for (name, type) from the stats engine. */
function pointValue(name: string, type: string): number {
  return STAT_ACTION_DEFAULTS.find((d) => d.name === name && d.type === type)?.value ?? 0
}

/** Points produced by a stat profile. */
export function profilePoints(p: StatProfile): number {
  return (
    pointValue('2pts', 'success') * p.twoPtMade +
    pointValue('3pts', 'success') * p.threePtMade +
    pointValue('free-throw', 'success') * p.ftMade
  )
}

/** Sum of points across a lineup's profiles. */
export function teamPoints(profiles: readonly StatProfile[]): number {
  return profiles.reduce((sum, p) => sum + profilePoints(p), 0)
}

// --- Profile constants ---
// Lineup order: [0]=star(Marius), [1]=good, [2]=avg, [3]=avg, [4]=weak

export const CLOSE_WIN_PROFILES: readonly StatProfile[] = [
  {
    assists: 7,
    blocks: 1,
    defReb: 6,
    fouls: 2,
    ftMade: 4,
    ftMiss: 2,
    offReb: 3,
    steals: 2,
    threePtMade: 2,
    threePtMiss: 3,
    turnovers: 3,
    twoPtMade: 8,
    twoPtMiss: 4,
  },
  {
    assists: 4,
    blocks: 0,
    defReb: 4,
    fouls: 3,
    ftMade: 3,
    ftMiss: 1,
    offReb: 2,
    steals: 1,
    threePtMade: 1,
    threePtMiss: 2,
    turnovers: 2,
    twoPtMade: 6,
    twoPtMiss: 3,
  },
  {
    assists: 2,
    blocks: 0,
    defReb: 3,
    fouls: 2,
    ftMade: 1,
    ftMiss: 1,
    offReb: 1,
    steals: 1,
    threePtMade: 1,
    threePtMiss: 2,
    turnovers: 2,
    twoPtMade: 5,
    twoPtMiss: 3,
  },
  {
    assists: 3,
    blocks: 0,
    defReb: 3,
    fouls: 3,
    ftMade: 4,
    ftMiss: 2,
    offReb: 1,
    steals: 0,
    threePtMade: 0,
    threePtMiss: 1,
    turnovers: 1,
    twoPtMade: 4,
    twoPtMiss: 2,
  },
  {
    assists: 1,
    blocks: 0,
    defReb: 1,
    fouls: 2,
    ftMade: 2,
    ftMiss: 1,
    offReb: 1,
    steals: 0,
    threePtMade: 0,
    threePtMiss: 1,
    turnovers: 2,
    twoPtMade: 3,
    twoPtMiss: 3,
  },
]

export const CLOSE_WIN_OPPONENT: StatProfile = {
  assists: 12,
  blocks: 2,
  defReb: 8,
  fouls: 5,
  ftMade: 6,
  ftMiss: 3,
  offReb: 6,
  steals: 6,
  threePtMade: 5,
  threePtMiss: 3,
  turnovers: 10,
  twoPtMade: 27,
  twoPtMiss: 4,
}

export const BLOWOUT_WIN_PROFILES: readonly StatProfile[] = [
  {
    assists: 9,
    blocks: 2,
    defReb: 8,
    fouls: 1,
    ftMade: 3,
    ftMiss: 1,
    offReb: 4,
    steals: 3,
    threePtMade: 3,
    threePtMiss: 2,
    turnovers: 2,
    twoPtMade: 9,
    twoPtMiss: 2,
  },
  {
    assists: 5,
    blocks: 0,
    defReb: 5,
    fouls: 2,
    ftMade: 3,
    ftMiss: 1,
    offReb: 2,
    steals: 2,
    threePtMade: 1,
    threePtMiss: 1,
    turnovers: 1,
    twoPtMade: 7,
    twoPtMiss: 2,
  },
  {
    assists: 3,
    blocks: 0,
    defReb: 4,
    fouls: 2,
    ftMade: 4,
    ftMiss: 1,
    offReb: 1,
    steals: 1,
    threePtMade: 0,
    threePtMiss: 1,
    turnovers: 2,
    twoPtMade: 6,
    twoPtMiss: 2,
  },
  {
    assists: 2,
    blocks: 0,
    defReb: 3,
    fouls: 3,
    ftMade: 1,
    ftMiss: 1,
    offReb: 1,
    steals: 0,
    threePtMade: 1,
    threePtMiss: 1,
    turnovers: 1,
    twoPtMade: 5,
    twoPtMiss: 2,
  },
  {
    assists: 0,
    blocks: 0,
    defReb: 2,
    fouls: 1,
    ftMade: 0,
    ftMiss: 0,
    offReb: 0,
    steals: 0,
    threePtMade: 0,
    threePtMiss: 0,
    turnovers: 1,
    twoPtMade: 4,
    twoPtMiss: 2,
  },
]

export const BLOWOUT_WIN_OPPONENT: StatProfile = {
  assists: 8,
  blocks: 1,
  defReb: 10,
  fouls: 6,
  ftMade: 6,
  ftMiss: 2,
  offReb: 4,
  steals: 3,
  threePtMade: 3,
  threePtMiss: 4,
  turnovers: 12,
  twoPtMade: 20,
  twoPtMiss: 5,
}

export const BLOWOUT_LOSS_PROFILES: readonly StatProfile[] = [
  {
    assists: 5,
    blocks: 0,
    defReb: 5,
    fouls: 3,
    ftMade: 3,
    ftMiss: 2,
    offReb: 2,
    steals: 1,
    threePtMade: 1,
    threePtMiss: 3,
    turnovers: 4,
    twoPtMade: 8,
    twoPtMiss: 5,
  },
  {
    assists: 2,
    blocks: 0,
    defReb: 3,
    fouls: 3,
    ftMade: 4,
    ftMiss: 2,
    offReb: 1,
    steals: 1,
    threePtMade: 0,
    threePtMiss: 2,
    turnovers: 3,
    twoPtMade: 5,
    twoPtMiss: 3,
  },
  {
    assists: 1,
    blocks: 0,
    defReb: 2,
    fouls: 2,
    ftMade: 2,
    ftMiss: 2,
    offReb: 1,
    steals: 0,
    threePtMade: 0,
    threePtMiss: 1,
    turnovers: 2,
    twoPtMade: 4,
    twoPtMiss: 3,
  },
  {
    assists: 1,
    blocks: 0,
    defReb: 2,
    fouls: 2,
    ftMade: 2,
    ftMiss: 1,
    offReb: 0,
    steals: 0,
    threePtMade: 0,
    threePtMiss: 2,
    turnovers: 2,
    twoPtMade: 3,
    twoPtMiss: 3,
  },
  {
    assists: 0,
    blocks: 0,
    defReb: 1,
    fouls: 1,
    ftMade: 0,
    ftMiss: 0,
    offReb: 0,
    steals: 0,
    threePtMade: 0,
    threePtMiss: 1,
    turnovers: 1,
    twoPtMade: 3,
    twoPtMiss: 2,
  },
]

export const BLOWOUT_LOSS_OPPONENT: StatProfile = {
  assists: 14,
  blocks: 3,
  defReb: 12,
  fouls: 4,
  ftMade: 8,
  ftMiss: 3,
  offReb: 8,
  steals: 7,
  threePtMade: 4,
  threePtMiss: 4,
  turnovers: 8,
  twoPtMade: 30,
  twoPtMiss: 6,
}

// --- Scenario registry (single source of truth) ---

export const MATCH_SCENARIOS = {
  blowoutLoss: { opponent: BLOWOUT_LOSS_OPPONENT, profiles: BLOWOUT_LOSS_PROFILES },
  blowoutWin: { opponent: BLOWOUT_WIN_OPPONENT, profiles: BLOWOUT_WIN_PROFILES },
  closeWin: { opponent: CLOSE_WIN_OPPONENT, profiles: CLOSE_WIN_PROFILES },
} as const satisfies Record<string, MatchScenarioConfig>

// --- Derived targets (cannot drift from their source profiles) ---

/** Compute the team/opponent score target for a scenario config. */
export function scenarioTarget(config: MatchScenarioConfig): ScenarioTarget {
  return { opponent: profilePoints(config.opponent), team: teamPoints(config.profiles) }
}

export const TARGET_CLOSE_WIN = scenarioTarget(MATCH_SCENARIOS.closeWin)
export const TARGET_BLOWOUT_WIN = scenarioTarget(MATCH_SCENARIOS.blowoutWin)
export const TARGET_BLOWOUT_LOSS = scenarioTarget(MATCH_SCENARIOS.blowoutLoss)
