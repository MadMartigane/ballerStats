import type { PlayerRawData } from '../player/player.d'
import type { TeamRawData } from '../team/team.d'
import type { TrombiTitles } from '../trombi-titles'
import { getUniqId } from '../utils/utils'
import type { ClubRawData } from './club.d'
import type { ClubMigrationInput, ClubMigrationResult } from './club-migration.d'

/** Default club for an empty store: guarantees the UI always has a club to display/edit. */
export function createDefaultClubData(): ClubRawData {
  return { id: getUniqId(), name: '' }
}

/**
 * Idempotent bridge to the Club entity:
 * - guarantees exactly one club when `clubs` is empty (legacy `clubName` if present, else a nameless default),
 * - attaches the club id to every player/team missing one,
 * - strips the legacy `clubName` field out of the trombi titles.
 */
export function migrateClubData(input: ClubMigrationInput): ClubMigrationResult {
  const players = input.players ?? []
  const teams = input.teams ?? []
  const titles = input.trombiTitles ?? {}
  const legacyClubName = titles.clubName
  const hadLegacyClubName = Object.hasOwn(titles, 'clubName')

  let clubs = input.clubs ?? []
  let changed = false

  if (clubs.length === 0) {
    const club: ClubRawData = legacyClubName ? { id: getUniqId(), name: legacyClubName } : createDefaultClubData()
    clubs = [club]
    changed = true
  }

  const [firstClub] = clubs
  let clubId = firstClub.id
  if (!clubId) {
    clubId = getUniqId()
    clubs = [{ ...firstClub, id: clubId }]
    changed = true
  }

  const migratedPlayers: PlayerRawData[] = players.map((player) => {
    if (player.clubId) {
      return player
    }
    changed = true
    return { ...player, clubId }
  })
  const migratedTeams: TeamRawData[] = teams.map((team) => {
    if (team.clubId) {
      return team
    }
    changed = true
    return { ...team, clubId }
  })

  const trombiTitles: TrombiTitles = { teamName: titles.teamName ?? '' }
  if (hadLegacyClubName) {
    changed = true
  }

  return { changed, clubs, players: migratedPlayers, teams: migratedTeams, trombiTitles }
}
