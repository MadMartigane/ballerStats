import type Match from '../../match'
import type { MatchRawData, MatchStatLogEntry } from '../../match/match.d'
import { TEAM_OPPONENT_ID } from '../../team/team'
import { makeMatch } from '../factories/match.factory'
import { makeStatEntry } from '../factories/stat-entry.factory'
import type { MatchScenarioConfig, StatProfile } from './match-profiles'
import { MATCH_SCENARIOS, STAT_FIELD_SPECS } from './match-profiles'

const GAME_START_TS = 1_700_000_000_000
const TICK_MS = 1000 // 1 second between actions; deterministic ordering

function requirePlayers(scope: string, ids: string[]): void {
  if (ids.length === 0) {
    throw new Error(`[${scope}] playerIds must contain at least one player.`)
  }
}

// --- Internal helpers ---

/** Build stat entries for one profile, returning the entries and the next free tick. */
function buildStatsFromProfile(
  startTick: number,
  playerId: string,
  p: StatProfile
): { entries: MatchStatLogEntry[]; nextTick: number } {
  let tick = startTick
  const entries: MatchStatLogEntry[] = []
  for (const spec of STAT_FIELD_SPECS) {
    const count = p[spec.field]
    for (let i = 0; i < count; i++) {
      entries.push(
        makeStatEntry(spec.statName, { type: spec.statType, playerId, timestamp: GAME_START_TS + tick++ * TICK_MS })
      )
    }
  }
  return { entries, nextTick: tick }
}

// --- Core builder ---

/** Build a locked match from explicit profiles. Scores are implied by the profiles. */
function buildMatchFromProfiles(
  teamId: string,
  lineup: string[],
  config: MatchScenarioConfig,
  overrides?: Partial<MatchRawData>
): Match {
  requirePlayers('buildMatchFromProfiles', lineup)
  if (config.profiles.length !== lineup.length) {
    throw new Error(
      `[buildMatchFromProfiles] profiles length (${config.profiles.length}) must match lineup (${lineup.length})`
    )
  }

  const stats: MatchStatLogEntry[] = []
  let tick = 0

  for (const [i, playerId] of lineup.entries()) {
    const result = buildStatsFromProfile(tick, playerId, config.profiles[i])
    stats.push(...result.entries)
    tick = result.nextTick
  }
  const oppResult = buildStatsFromProfile(tick, TEAM_OPPONENT_ID, config.opponent)
  stats.push(...oppResult.entries)

  return makeMatch({
    teamId,
    opponent: 'Profile Opponent',
    type: 'home',
    status: 'locked',
    date: new Date(GAME_START_TS).toISOString(),
    playersInTheFive: lineup.slice(0, 5),
    stats,
    ...overrides,
  })
}

// --- Scenario dispatcher ---

/** Build a match from a named scenario (key of MATCH_SCENARIOS). */
export function makeScenarioMatch(
  name: keyof typeof MATCH_SCENARIOS,
  teamId: string,
  lineup: string[],
  overrides?: Partial<MatchRawData>
): Match {
  return buildMatchFromProfiles(teamId, lineup, MATCH_SCENARIOS[name], overrides)
}

/** Empty match (no stats), but still registerable. */
export function makeEmptyMatch(teamId: string, overrides?: Partial<MatchRawData>): Match {
  return makeMatch({
    teamId,
    opponent: 'Empty Opponent',
    type: 'home',
    stats: [],
    status: 'unlocked',
    date: null,
    ...overrides,
  })
}

/** In-progress match: partial stats, unlocked, no end-of-game signals. */
export function makePartialMatch(teamId: string, playerIds: string[], overrides?: Partial<MatchRawData>): Match {
  const starters = playerIds.slice(0, 5)
  requirePlayers('makePartialMatch', starters)
  const stats: MatchStatLogEntry[] = []
  for (const [i, playerId] of starters.entries()) {
    stats.push(makeStatEntry('2pts', { type: 'success', playerId, timestamp: GAME_START_TS + i }))
    stats.push(makeStatEntry('assist', { type: 'success', playerId, timestamp: GAME_START_TS + i + 10 }))
  }
  stats.push(makeStatEntry('2pts', { type: 'success', playerId: TEAM_OPPONENT_ID, timestamp: GAME_START_TS + 100 }))
  return makeMatch({
    teamId,
    opponent: 'Partial Opponent',
    type: 'home',
    status: 'unlocked',
    date: new Date(GAME_START_TS).toISOString(),
    playersInTheFive: starters,
    stats,
    ...overrides,
  })
}
