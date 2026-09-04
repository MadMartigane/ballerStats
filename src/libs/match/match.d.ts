import type { StatMatchActionItem } from '../stats/stats.d'

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
  opponent?: string | null
  playersInTheFive?: string[]
  stats?: MatchStatLogEntry[]
  status?: MatchStatus
  teamId?: string | null
  type?: MatchType
}
