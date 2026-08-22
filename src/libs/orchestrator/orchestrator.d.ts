import type Contact from '../contact/contact'
import type { ContactRawData } from '../contact/contact.d'
import type Match from '../match/match'
import type { MatchRawData } from '../match/match.d'
import type Player from '../player/player'
import type { PlayerRawData } from '../player/player.d'
import type Team from '../team/team'
import type { TeamRawData } from '../team/team.d'
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
