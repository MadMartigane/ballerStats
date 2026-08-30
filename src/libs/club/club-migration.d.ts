import type { PlayerRawData } from '../player/player.d'
import type { TeamRawData } from '../team/team.d'
import type { TrombiTitles } from '../trombi-titles'
import type { ClubRawData } from './club.d'

export interface ClubMigrationInput {
  clubs?: ClubRawData[]
  players?: PlayerRawData[]
  teams?: TeamRawData[]
  /** Raw stored titles; may still carry the legacy `clubName` field on older stores/archives. */
  trombiTitles?: Partial<TrombiTitles> & { clubName?: string }
}

export interface ClubMigrationResult {
  changed: boolean
  clubs: ClubRawData[]
  players: PlayerRawData[]
  teams: TeamRawData[]
  trombiTitles: TrombiTitles
}
