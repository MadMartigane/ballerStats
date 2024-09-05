import Match from '../match'
import { TEAM_OPPONENT_ID } from '../team/team'
import { StatMatchActionItemName, StatMatchSummary, StatMatchSummaryPlayer } from './stats.d'

function getPlayerIdsInStats(match: Match) {
  return match.stats
    .filter(stats => stats.playerId !== TEAM_OPPONENT_ID)
    .map(stats => stats.playerId)
    .reduce((result, playerId) => {
      if (result.includes(playerId)) {
        return result
      }

      result.push(playerId)
      return result
    }, [] as Array<string>)
}

export function getPlayerScore(match: Match, playerId: string) {
  return match.stats.reduce((score, statEntry) => {
    if (
      ['2pts', 'free-throw', '3pts'].includes(statEntry.name) &&
      statEntry.playerId === playerId
    ) {
      return score + statEntry.value
    }

    return score
  }, 0)
}

function getPlayerStatByType(match: Match, playerId: string, type: StatMatchActionItemName) {
  return match.stats.reduce((score, statEntry) => {
    if (
      statEntry.name === type &&
      statEntry.playerId === playerId
    ) {
      return score + statEntry.value
    }

    return score
  }, 0)
}

export function getPlayerOffensiveRebonds(match: Match, playerId: string) {
  return getPlayerStatByType(match, playerId, 'offensive-rebond')
}

export function getPlayerDefensiveRebonds(match: Match, playerId: string) {
  return getPlayerStatByType(match, playerId, 'defensive-rebond')
}

export function getPlayerAssists(match: Match, playerId: string){
  return getPlayerStatByType(match, playerId, 'assist')
}

export function getPlayerFouls(match: Match, playerId: string){
  return getPlayerStatByType(match, playerId, 'foul')
}

export function getLocalScore(match: Match, playerIds: Array<string>) {
  return playerIds.reduce(
    (score: number, playerId) => score + getPlayerScore(match, playerId),
    0,
  )
}

export function getOpponentScore(match: Match) {
  return getPlayerScore(match, TEAM_OPPONENT_ID)
}

export function getOpponentOffensiveRebonds(match: Match) {
  return getPlayerStatByType(match, TEAM_OPPONENT_ID, 'offensive-rebond')
}

export function getOpponentDefensiveRebonds(match: Match) {
  return getPlayerStatByType(match, TEAM_OPPONENT_ID, 'defensive-rebond')
}

export function getOpponentFouls(match: Match) {
  return getPlayerStatByType(match, TEAM_OPPONENT_ID, 'foul')
}



export function getStatSummary(match: Match | null): StatMatchSummary {
  if (!match) {
    return {
      localScore: 0,
      opponentScore: 0,
      opponentRebonds: 0,
      opponentFouls: 0,
      players: {},
    }
  }

  const playerIds = getPlayerIdsInStats(match)
  const players = playerIds.reduce(
    (result: StatMatchSummaryPlayer, playerId) => {
      result[playerId] = {
        score: getPlayerScore(match, playerId),
        rebonds: getPlayerDefensiveRebonds(match, playerId) + getPlayerOffensiveRebonds(match, playerId),
        assists: getPlayerAssists(match, playerId),
        fouls: getPlayerFouls(match, playerId),
      }

      return result
    },
    {} as StatMatchSummaryPlayer,
  )

  return {
    localScore: getLocalScore(match, playerIds),
    opponentScore: getOpponentScore(match),
    opponentRebonds: getOpponentDefensiveRebonds(match) + getOpponentOffensiveRebonds(match),
    opponentFouls: getOpponentFouls(match),
    players,
  }
}
