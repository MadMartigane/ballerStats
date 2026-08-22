import Match from '../../match/match'
import type { MatchRawData } from '../../match/match.d'
import { nextId } from '../mock-counter'

const ID_PREFIX = 'mock-match'

/**
 * Build a deterministic Match. Defaults satisfy isRegisterable
 * (opponent + type + teamId all set, see match.ts:41-43).
 */
export function makeMatch(overrides: Partial<MatchRawData> = {}): Match {
  const raw: MatchRawData = {
    date: null,
    opponent: 'Mock Opponent',
    playersInTheFive: [],
    stats: [],
    status: 'unlocked',
    teamId: 'mock-team-1',
    type: 'home',
    ...overrides,
    id: overrides.id ?? nextId(ID_PREFIX),
  }
  return new Match(raw)
}
