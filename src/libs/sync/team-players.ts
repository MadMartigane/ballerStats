import type PocketBase from 'pocketbase'
import type { ClientResponseError } from 'pocketbase'
import { isPbId } from './mapper'

interface TeamPlayersRecord {
  id: string
  player: string
}

function errorStatus(err: unknown): number {
  return err instanceof Error ? ((err as ClientResponseError).status ?? 0) : 0
}

/**
 * Keeps the `team_players` junction in sync with `teams.playerIds` after a
 * team push: creates missing rows, deletes rows whose player left the team.
 * Players without a PB id (legacy, not yet pushed) are skipped. Duplicate
 * creates (unique index race with the players_attach hook) are tolerated.
 */
export async function syncTeamPlayers(
  pb: PocketBase,
  clubId: string,
  teamPbId: string,
  playerPbIds: string[],
  onError: (message: string) => void
): Promise<void> {
  const service = pb.collection('team_players')
  let existing: TeamPlayersRecord[]
  try {
    existing = (await service.getFullList({
      filter: pb.filter('team = {:team}', { team: teamPbId }),
    })) as TeamPlayersRecord[]
  } catch (err) {
    onError(String(err))
    return
  }

  const expected = new Set(playerPbIds.filter(isPbId))
  const existingByPlayer = new Map(existing.map((row) => [row.player, row]))

  await Promise.all(
    [...expected].map(async (playerId) => {
      if (existingByPlayer.has(playerId)) {
        return
      }
      try {
        await service.create({ club: clubId, player: playerId, team: teamPbId })
      } catch (err) {
        if (errorStatus(err) !== 400) {
          onError(`team_players create failed for ${playerId}: ${String(err)}`)
        }
      }
    })
  )

  await Promise.all(
    existing.map(async (row) => {
      if (expected.has(row.player)) {
        return
      }
      try {
        await service.delete(row.id)
      } catch (err) {
        onError(`team_players delete failed for ${row.id}: ${String(err)}`)
      }
    })
  )
}
