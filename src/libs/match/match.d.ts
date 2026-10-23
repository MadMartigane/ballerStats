import type { StatMatchActionItem } from '../stats/stats.d'
import type { MatchFormatConfig } from '../team/match-format'
import type { MatchClockData } from './clock.d'

export type MatchType = 'home' | 'outside'
export type MatchStatus = 'locked' | 'unlocked'

export type MatchStatLogEntry = Pick<StatMatchActionItem, 'name' | 'type' | 'value'> & {
  /** Clock time remaining in the period when the event was logged, in milliseconds. Absent on legacy events. */
  clockRemainingMs?: number
  /** 1-based period index when the event was logged. Absent on legacy events. */
  period?: number
  playerId: string | null
  timestamp: number
}

export interface MatchRawData {
  championship?: string | null
  /** Live game clock state. Absent on matches saved before palier 1. */
  clock?: MatchClockData | null
  /** 1-based current period index. Absent on matches saved before palier 1. */
  currentPeriod?: number | null
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
