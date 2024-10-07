import type { PlayerRawData } from '../player'
import type { TeamRawData } from '../team'
import type { MatchRawData } from '../match'

export type GlobalDB = {
  timestamp: number
  players: Array<PlayerRawData>
  teams: Array<TeamRawData>
  matchs: Array<MatchRawData>
}
