import type { StatMatchActionItem } from '../stats/stats.d'
import type { MatchFormatConfig } from '../team/match-format'

export type MatchType = 'home' | 'outside'
export type MatchStatus = 'locked' | 'unlocked'

export type MatchStatLogEntry = Pick<StatMatchActionItem, 'name' | 'type' | 'value'> & {
  playerId: string | null
  timestamp: number
}

export interface MatchRawData {
  championship?: string | null
  date?: string | null
  id?: string
  /** Format this match was played under; owns the real value, falling back to the team default. */
  matchFormat?: MatchFormatConfig | null
  opponent?: string | null
  playersInTheFive?: string[]
  stats?: MatchStatLogEntry[]
  status?: MatchStatus
  /** Optional table-recorded play times, in whole minutes, keyed by playerId. */
  tablePlayTimes?: Record<string, number>
  teamId?: string | null
  type?: MatchType
}
