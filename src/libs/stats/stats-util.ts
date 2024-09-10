import Match from '../match'
import { TEAM_OPPONENT_ID } from '../team/team'
import {
  StatMatchActionItemName,
  StatMatchActionItemType,
  StatMatchSummary,
  StatMatchSummaryPlayer,
  StatMatchSummaryRebonds,
} from './stats.d'

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

function getPlayerStatByType(
  match: Match,
  playerId: string,
  type: StatMatchActionItemName,
) {
  return match.stats.reduce((score, statEntry) => {
    if (statEntry.name === type && statEntry.playerId === playerId) {
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

export function getPlayerAssists(match: Match, playerId: string) {
  return getPlayerStatByType(match, playerId, 'assist')
}

export function getPlayerFouls(match: Match, playerId: string) {
  return getPlayerStatByType(match, playerId, 'foul')
}

export function getPlayerTurnovers(match: Match, playerId: string) {
  return getPlayerStatByType(match, playerId, 'turnover')
}

export function getTeamScore(match: Match, playerIds: Array<string>) {
  return playerIds.reduce(
    (score: number, playerId) => score + getPlayerScore(match, playerId),
    0,
  )
}

export function getTeamAssists(playersStats: StatMatchSummaryPlayer) {
  return Object.keys(playersStats).reduce((result, playerId) => {
    return result + playersStats[playerId].assists
  }, 0)
}

export function getTeamTurnovers(playersStats: StatMatchSummaryPlayer) {
  return Object.keys(playersStats).reduce((result, playerId) => {
    return result + playersStats[playerId].turnover
  }, 0)
}

export function getPlayerNumberByType(
  match: Match,
  playerId: string,
  name: StatMatchActionItemName,
  type: StatMatchActionItemType,
) {
  return match.stats.reduce((score, statEntry) => {
    if (
      statEntry.playerId === playerId &&
      statEntry.name === name &&
      statEntry.type === type
    ) {
      return score + 1
    }

    return score
  }, 0)
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

export function getTeamDefensiveRebonds(
  match: Match,
  playerIds: Array<string>,
) {
  return playerIds.reduce((result, playerId) => {
    return result + getPlayerStatByType(match, playerId, 'defensive-rebond')
  }, 0)
}

export function getTeamOffensiveRebonds(
  match: Match,
  playerIds: Array<string>,
) {
  return playerIds.reduce((result, playerId) => {
    return result + getPlayerStatByType(match, playerId, 'offensive-rebond')
  }, 0)
}

export function getFullRebondStats(
  match: Match,
  playerIds: Array<string>,
): StatMatchSummaryRebonds {
  const opponentDefensive = getOpponentDefensiveRebonds(match)
  const opponentOffensive = getOpponentOffensiveRebonds(match)
  const opponentTotal = opponentDefensive + opponentOffensive

  const teamOffensive = getTeamOffensiveRebonds(match, playerIds)
  const teamDefensive = getTeamDefensiveRebonds(match, playerIds)
  const teamTotal = teamDefensive + teamOffensive

  const teamTotalPercentage =
    Math.round((teamTotal / (opponentTotal + teamTotal)) * 100) || 0
  const teamDefensivePercentage =
    Math.round((teamDefensive / (opponentDefensive + teamDefensive)) * 100) || 0
  const teamOffensivePercentage =
    Math.round((teamOffensive / (opponentOffensive + teamOffensive)) * 100) || 0

  return {
    teamTotal,
    teamOffensive,
    teamDefensive,
    teamTotalPercentage,
    teamOffensivePercentage,
    teamDefensivePercentage,
    opponentTotal,
    opponentDefensive,
    opponentOffensive,
  }
}

export function getStatSummary(match: Match | null): StatMatchSummary {
  if (!match) {
    return {
      teamScore: 0,
      opponentScore: 0,
      opponentFouls: 0,
      players: {},
      teamAssists: 0,
      teamTurnover: 0,
      rebonds: {
        teamTotal: 0,
        teamOffensive: 0,
        teamDefensive: 0,
        teamTotalPercentage: 0,
        teamOffensivePercentage: 0,
        teamDefensivePercentage: 0,
        opponentTotal: 0,
        opponentDefensive: 0,
        opponentOffensive: 0,
      },
    }
  }

  const playerIds = getPlayerIdsInStats(match)
  const players = playerIds.reduce(
    (result: StatMatchSummaryPlayer, playerId) => {
      result[playerId] = {
        scores: {
          '2pts': getPlayerStatByType(match, playerId, '2pts'),
          '3pts': getPlayerStatByType(match, playerId, '3pts'),
          'free-throw': getPlayerStatByType(match, playerId, 'free-throw'),
          total: 0,
        },
        rebonds: {
          defensive: getPlayerDefensiveRebonds(match, playerId),
          offensive: getPlayerOffensiveRebonds(match, playerId),
          total: 0,
        },
        ratio: {
          'free-throw': {
            success: getPlayerNumberByType(
              match,
              playerId,
              'free-throw',
              'success',
            ),
            fail: getPlayerNumberByType(match, playerId, 'free-throw', 'error'),
            total: 0,
            percentage: 0,
          },
          '2pts': {
            success: getPlayerNumberByType(match, playerId, '2pts', 'success'),
            fail: getPlayerNumberByType(match, playerId, '2pts', 'error'),
            total: 0,
            percentage: 0,
          },
          '3pts': {
            success: getPlayerNumberByType(match, playerId, '3pts', 'success'),
            fail: getPlayerNumberByType(match, playerId, '3pts', 'error'),
            total: 0,
            percentage: 0,
          },
        },
        assists: getPlayerAssists(match, playerId),
        fouls: getPlayerFouls(match, playerId),
        turnover: getPlayerTurnovers(match, playerId),
      }

      // TODO: TOTAL
      result[playerId].scores.total =
        result[playerId].scores['2pts'] +
        result[playerId].scores['3pts'] +
        result[playerId].scores['free-throw']

      result[playerId].rebonds.total =
        result[playerId].rebonds.offensive + result[playerId].rebonds.defensive

      result[playerId].ratio['2pts'].total =
        result[playerId].ratio['2pts'].fail +
        result[playerId].ratio['2pts'].success

      result[playerId].ratio['2pts'].percentage =
        Math.round(
          (result[playerId].ratio['2pts'].success /
            result[playerId].ratio['2pts'].total) *
            100,
        ) || 0

      result[playerId].ratio['3pts'].total =
        result[playerId].ratio['3pts'].fail +
        result[playerId].ratio['3pts'].success

      result[playerId].ratio['3pts'].percentage =
        Math.round(
          (result[playerId].ratio['3pts'].success /
            result[playerId].ratio['3pts'].total) *
            100,
        ) || 0

      result[playerId].ratio['free-throw'].total =
        result[playerId].ratio['free-throw'].fail +
        result[playerId].ratio['free-throw'].success

      result[playerId].ratio['free-throw'].percentage =
        Math.round(
          (result[playerId].ratio['free-throw'].success /
            result[playerId].ratio['free-throw'].total) *
            100,
        ) || 0

      return result
    },
    {} as StatMatchSummaryPlayer,
  )

  const rebonds = getFullRebondStats(match, playerIds)

  return {
    teamScore: getTeamScore(match, playerIds),
    opponentScore: getOpponentScore(match),
    opponentFouls: getOpponentFouls(match),
    players,
    rebonds,
    teamAssists: getTeamAssists(players),
    teamTurnover: getTeamTurnovers(players),
  }
}
