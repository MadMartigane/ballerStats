import type { MatchRawData } from '../match'
import type { PlayerRawData } from '../player'
import type { TeamRawData } from '../team'
import type { TrombiTitles } from '../trombi-titles'

export interface GlobalDB {
  timestamp: number
  players: PlayerRawData[]
  teams: TeamRawData[]
  matchs: MatchRawData[]
  trombiTitles?: TrombiTitles
}
