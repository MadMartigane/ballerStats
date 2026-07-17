import type Contact from '../contact'
import type { ContactRawData } from '../contact'
import type Match from '../match'
import type { MatchRawData } from '../match'
import type Player from '../player'
import type { PlayerRawData } from '../player'
import type Team from '../team'
import type { TeamRawData } from '../team'
import type { TrombiTitles } from '../trombi-titles'

export interface DomainDataset {
  contacts?: Contact[]
  matchs?: Match[]
  players?: Player[]
  teams?: Team[]
}

export interface GlobalDB {
  contacts?: ContactRawData[]
  matchs: MatchRawData[]
  players: PlayerRawData[]
  teams: TeamRawData[]
  timestamp: number
  trombiTitles?: TrombiTitles
}
