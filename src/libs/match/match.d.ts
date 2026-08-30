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
  deletedAt?: number | null // tombstone: ms epoch when soft-deleted, null when live (absent on legacy data)
  id?: string
  opponent?: string | null
  playersInTheFive?: string[]
  stats?: MatchStatLogEntry[]
  status?: MatchStatus
  teamId?: string | null
  type?: MatchType
  updatedAt?: number // ms epoch of last mutation (0 on legacy data)
}
