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
  statName: string
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
    twoPtMade: 8,
    twoPtMiss: 4,
    threePtMade: 2,
    threePtMiss: 3,
    ftMade: 4,
    ftMiss: 2,
    offReb: 3,
    defReb: 6,
    assists: 7,
    steals: 2,
    blocks: 1,
    turnovers: 3,
    fouls: 2,
  },
  {
    twoPtMade: 6,
    twoPtMiss: 3,
    threePtMade: 1,
    threePtMiss: 2,
    ftMade: 3,
    ftMiss: 1,
    offReb: 2,
    defReb: 4,
    assists: 4,
    steals: 1,
    blocks: 0,
    turnovers: 2,
    fouls: 3,
  },
  {
    twoPtMade: 5,
    twoPtMiss: 3,
    threePtMade: 1,
    threePtMiss: 2,
    ftMade: 1,
    ftMiss: 1,
    offReb: 1,
    defReb: 3,
    assists: 2,
    steals: 1,
    blocks: 0,
    turnovers: 2,
    fouls: 2,
  },
  {
    twoPtMade: 4,
    twoPtMiss: 2,
    threePtMade: 0,
    threePtMiss: 1,
    ftMade: 4,
    ftMiss: 2,
    offReb: 1,
    defReb: 3,
    assists: 3,
    steals: 0,
    blocks: 0,
    turnovers: 1,
    fouls: 3,
  },
  {
    twoPtMade: 3,
    twoPtMiss: 3,
    threePtMade: 0,
    threePtMiss: 1,
    ftMade: 2,
    ftMiss: 1,
    offReb: 1,
    defReb: 1,
    assists: 1,
    steals: 0,
    blocks: 0,
    turnovers: 2,
    fouls: 2,
  },
]

export const CLOSE_WIN_OPPONENT: StatProfile = {
  twoPtMade: 27,
  twoPtMiss: 4,
  threePtMade: 5,
  threePtMiss: 3,
  ftMade: 6,
  ftMiss: 3,
  offReb: 6,
  defReb: 8,
  assists: 12,
  steals: 6,
  blocks: 2,
  turnovers: 10,
  fouls: 5,
}

export const BLOWOUT_WIN_PROFILES: readonly StatProfile[] = [
  {
    twoPtMade: 9,
    twoPtMiss: 2,
    threePtMade: 3,
    threePtMiss: 2,
    ftMade: 3,
    ftMiss: 1,
    offReb: 4,
    defReb: 8,
    assists: 9,
    steals: 3,
    blocks: 2,
    turnovers: 2,
    fouls: 1,
  },
  {
    twoPtMade: 7,
    twoPtMiss: 2,
    threePtMade: 1,
    threePtMiss: 1,
    ftMade: 3,
    ftMiss: 1,
    offReb: 2,
    defReb: 5,
    assists: 5,
    steals: 2,
    blocks: 0,
    turnovers: 1,
    fouls: 2,
  },
  {
    twoPtMade: 6,
    twoPtMiss: 2,
    threePtMade: 0,
    threePtMiss: 1,
    ftMade: 4,
    ftMiss: 1,
    offReb: 1,
    defReb: 4,
    assists: 3,
    steals: 1,
    blocks: 0,
    turnovers: 2,
    fouls: 2,
  },
  {
    twoPtMade: 5,
    twoPtMiss: 2,
    threePtMade: 1,
    threePtMiss: 1,
    ftMade: 1,
    ftMiss: 1,
    offReb: 1,
    defReb: 3,
    assists: 2,
    steals: 0,
    blocks: 0,
    turnovers: 1,
    fouls: 3,
  },
  {
    twoPtMade: 4,
    twoPtMiss: 2,
    threePtMade: 0,
    threePtMiss: 0,
    ftMade: 0,
    ftMiss: 0,
    offReb: 0,
    defReb: 2,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 1,
    fouls: 1,
  },
]

export const BLOWOUT_WIN_OPPONENT: StatProfile = {
  twoPtMade: 20,
  twoPtMiss: 5,
  threePtMade: 3,
  threePtMiss: 4,
  ftMade: 6,
  ftMiss: 2,
  offReb: 4,
  defReb: 10,
  assists: 8,
  steals: 3,
  blocks: 1,
  turnovers: 12,
  fouls: 6,
}

export const BLOWOUT_LOSS_PROFILES: readonly StatProfile[] = [
  {
    twoPtMade: 8,
    twoPtMiss: 5,
    threePtMade: 1,
    threePtMiss: 3,
    ftMade: 3,
    ftMiss: 2,
    offReb: 2,
    defReb: 5,
    assists: 5,
    steals: 1,
    blocks: 0,
    turnovers: 4,
    fouls: 3,
  },
  {
    twoPtMade: 5,
    twoPtMiss: 3,
    threePtMade: 0,
    threePtMiss: 2,
    ftMade: 4,
    ftMiss: 2,
    offReb: 1,
    defReb: 3,
    assists: 2,
    steals: 1,
    blocks: 0,
    turnovers: 3,
    fouls: 3,
  },
  {
    twoPtMade: 4,
    twoPtMiss: 3,
    threePtMade: 0,
    threePtMiss: 1,
    ftMade: 2,
    ftMiss: 2,
    offReb: 1,
    defReb: 2,
    assists: 1,
    steals: 0,
    blocks: 0,
    turnovers: 2,
    fouls: 2,
  },
  {
    twoPtMade: 3,
    twoPtMiss: 3,
    threePtMade: 0,
    threePtMiss: 2,
    ftMade: 2,
    ftMiss: 1,
    offReb: 0,
    defReb: 2,
    assists: 1,
    steals: 0,
    blocks: 0,
    turnovers: 2,
    fouls: 2,
  },
  {
    twoPtMade: 3,
    twoPtMiss: 2,
    threePtMade: 0,
    threePtMiss: 1,
    ftMade: 0,
    ftMiss: 0,
    offReb: 0,
    defReb: 1,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 1,
    fouls: 1,
  },
]

export const BLOWOUT_LOSS_OPPONENT: StatProfile = {
  twoPtMade: 30,
  twoPtMiss: 6,
  threePtMade: 4,
  threePtMiss: 4,
  ftMade: 8,
  ftMiss: 3,
  offReb: 8,
  defReb: 12,
  assists: 14,
  steals: 7,
  blocks: 3,
  turnovers: 8,
  fouls: 4,
}

// --- Scenario registry (single source of truth) ---

export const MATCH_SCENARIOS = {
  closeWin: { profiles: CLOSE_WIN_PROFILES, opponent: CLOSE_WIN_OPPONENT },
  blowoutWin: { profiles: BLOWOUT_WIN_PROFILES, opponent: BLOWOUT_WIN_OPPONENT },
  blowoutLoss: { profiles: BLOWOUT_LOSS_PROFILES, opponent: BLOWOUT_LOSS_OPPONENT },
} as const satisfies Record<string, MatchScenarioConfig>

// --- Derived targets (cannot drift from their source profiles) ---

/** Compute the team/opponent score target for a scenario config. */
export function scenarioTarget(config: MatchScenarioConfig): ScenarioTarget {
  return { team: teamPoints(config.profiles), opponent: profilePoints(config.opponent) }
}

export const TARGET_CLOSE_WIN = scenarioTarget(MATCH_SCENARIOS.closeWin)
export const TARGET_BLOWOUT_WIN = scenarioTarget(MATCH_SCENARIOS.blowoutWin)
export const TARGET_BLOWOUT_LOSS = scenarioTarget(MATCH_SCENARIOS.blowoutLoss)
