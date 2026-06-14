import type { MatchRawData } from '../match'
import type { PlayerRawData } from '../player'
import type { TeamRawData } from '../team'
import type { TrombiTitles } from '../trombi-titles'

export interface GlobalDB {
  matchs: MatchRawData[]
  players: PlayerRawData[]
  teams: TeamRawData[]
  timestamp: number
  trombiTitles?: TrombiTitles
}
