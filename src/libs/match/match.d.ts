import { StatMatchActionItem } from "../stats"

export type MatchType = 'home' | 'outside'
export type MatchStatus = 'locked' | 'unlocked'

export type MatchStatLogEntry = Pick<StatMatchActionItem, 'name' | 'type' | 'value'> & {
  playerId: string
}

export type MatchRawData = {
  id?: string
  opponent?: string | null
  type?: MatchType
  teamId?: string | null
  stats?: Array<MatchStatLogEntry>
  status?: MatchStatus
}
