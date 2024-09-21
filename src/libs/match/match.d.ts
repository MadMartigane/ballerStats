import type { StatMatchActionItem } from '../stats'

export type MatchType = 'home' | 'outside'
export type MatchStatus = 'locked' | 'unlocked'

export type MatchStatLogEntry = Pick<
  StatMatchActionItem,
  'name' | 'type' | 'value'
> & {
  playerId: string
  timestamp: number
}

export type MatchRawData = {
  id?: string
  opponent?: string | null
  type?: MatchType
  teamId?: string | null
  stats?: Array<MatchStatLogEntry>
  status?: MatchStatus
  date?: string | null
}
