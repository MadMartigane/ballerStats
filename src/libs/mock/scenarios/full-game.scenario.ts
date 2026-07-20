import type Match from '../../match'
import type { MatchRawData, MatchStatLogEntry } from '../../match/match.d'
import { TEAM_OPPONENT_ID } from '../../team/team'
import { makeMatch } from '../factories/match.factory'
import { makeStatEntry } from '../factories/stat-entry.factory'

const GAME_START_TS = 1_700_000_000_000
const TICK_MS = 1000 // 1 second between actions; deterministic ordering

function requirePlayers(scope: string, ids: string[]): void {
  if (ids.length === 0) {
    throw new Error(`[${scope}] playerIds must contain at least one player.`)
  }
}

/** A complete 40-min game with realistic stats for 5-8 players. */
export function makeFullGameMatch(teamId: string, playerIds: string[], overrides?: Partial<MatchRawData>): Match {
  requirePlayers('makeFullGameMatch', playerIds)

  const stats: MatchStatLogEntry[] = []
  let tick = 0
  const push = (count: number, build: (ts: number) => MatchStatLogEntry) => {
    for (let i = 0; i < count; i++) {
      stats.push(build(GAME_START_TS + tick++ * TICK_MS))
    }
  }

  for (const playerId of playerIds) {
    push(4, (ts) => makeStatEntry('2pts', { type: 'success', playerId, timestamp: ts }))
    push(3, (ts) => makeStatEntry('2pts', { type: 'error', playerId, timestamp: ts }))
    push(2, (ts) => makeStatEntry('3pts', { type: 'success', playerId, timestamp: ts }))
    push(2, (ts) => makeStatEntry('3pts', { type: 'error', playerId, timestamp: ts }))
    push(2, (ts) => makeStatEntry('free-throw', { type: 'success', playerId, timestamp: ts }))
    push(1, (ts) => makeStatEntry('free-throw', { type: 'error', playerId, timestamp: ts }))
    push(2, (ts) => makeStatEntry('offensive-rebond', { type: 'success', playerId, timestamp: ts }))
    push(3, (ts) => makeStatEntry('defensive-rebond', { type: 'secondary', playerId, timestamp: ts }))
    push(3, (ts) => makeStatEntry('assist', { type: 'success', playerId, timestamp: ts }))
    push(1, (ts) => makeStatEntry('steals', { type: 'success', playerId, timestamp: ts }))
    push(1, (ts) => makeStatEntry('block', { type: 'success', playerId, timestamp: ts }))
    push(2, (ts) => makeStatEntry('turnover', { type: 'error', playerId, timestamp: ts }))
    push(2, (ts) => makeStatEntry('foul', { type: 'error', playerId, timestamp: ts }))
  }

  push(10, (ts) => makeStatEntry('2pts', { type: 'success', playerId: TEAM_OPPONENT_ID, timestamp: ts }))
  push(4, (ts) => makeStatEntry('3pts', { type: 'success', playerId: TEAM_OPPONENT_ID, timestamp: ts }))
  push(3, (ts) => makeStatEntry('free-throw', { type: 'success', playerId: TEAM_OPPONENT_ID, timestamp: ts }))
  push(6, (ts) => makeStatEntry('defensive-rebond', { type: 'secondary', playerId: TEAM_OPPONENT_ID, timestamp: ts }))
  push(4, (ts) => makeStatEntry('offensive-rebond', { type: 'success', playerId: TEAM_OPPONENT_ID, timestamp: ts }))
  push(5, (ts) => makeStatEntry('foul', { type: 'error', playerId: TEAM_OPPONENT_ID, timestamp: ts }))

  return makeMatch({
    teamId,
    opponent: 'Full Game Opponent',
    type: 'home',
    status: 'locked',
    date: new Date(GAME_START_TS).toISOString(),
    playersInTheFive: playerIds.slice(0, 5),
    stats,
    ...overrides,
  })
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
