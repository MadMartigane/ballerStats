import type Match from '../match'
import orchestrator from '../orchestrator/orchestrator'
import { TEAM_OPPONENT_ID } from '../team/team'
import { clone } from '../utils'
import type {
  StatMatchActionItemName,
  StatMatchActionItemType,
  StatMatchSummary,
  StatMatchSummaryPlayer,
  StatMatchSummaryRebonds,
} from './stats.d'

const RAW_STAT_MATCH_SUMMARY: StatMatchSummary = {
  teamScore: 0,
  teamScores: {
    playTime: 0,
    playerId: '',
    nbPlayedMatch: 0,
    scores: {
      '2pts': 0,
      '3pts': 0,
      'free-throw': 0,
      total: 0,
    },
    rebonds: {
      defensive: 0,
      offensive: 0,
      total: 0,
    },
    ratio: {
      'free-throw': {
        success: 0,
        fail: 0,
        total: 0,
        percentage: 0,
      },
      '2pts': {
        success: 0,
        fail: 0,
        total: 0,
        percentage: 0,
      },
      '3pts': {
        success: 0,
        fail: 0,
        total: 0,
        percentage: 0,
      },
    },
    fouls: 0,
    turnover: 0,
    steals: 0,
    assists: 0,
  },
  opponentScore: 0,
  opponentFouls: 0,
  players: [],
  teamAssists: 0,
  teamTurnover: 0,
  teamSteals: 0,
  teamFouls: 0,
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

function getPlayerIdsInStats(match: Match) {
  return match.stats
    .filter((stats) => stats.playerId !== TEAM_OPPONENT_ID)
    .map((stats) => stats.playerId)
    .reduce(
      (result, playerId) => {
        if (!playerId || result.includes(playerId)) {
          return result
        }

        result.push(playerId)
        return result
      },
      [] as Array<string>,
    )
}

function getPlayerScore(match: Match, playerId: string) {
  return match.stats.reduce((score, statEntry) => {
    if (['2pts', 'free-throw', '3pts'].includes(statEntry.name) && statEntry.playerId === playerId) {
      return score + statEntry.value
    }

    return score
  }, 0)
}

function getPlayerStatByType(match: Match, playerId: string, type: StatMatchActionItemName) {
  return match.stats.reduce((score, statEntry) => {
    if (statEntry.name === type && statEntry.playerId === playerId) {
      return score + statEntry.value
    }

    return score
  }, 0)
}

function getPlayerOffensiveRebonds(match: Match, playerId: string) {
  return getPlayerStatByType(match, playerId, 'offensive-rebond')
}

function getPlayerDefensiveRebonds(match: Match, playerId: string) {
  return getPlayerStatByType(match, playerId, 'defensive-rebond')
}

function getPlayerAssists(match: Match, playerId: string) {
  return getPlayerStatByType(match, playerId, 'assist')
}

function getPlayerFouls(match: Match, playerId: string) {
  return getPlayerStatByType(match, playerId, 'foul')
}

function getPlayerTurnovers(match: Match, playerId: string) {
  return getPlayerStatByType(match, playerId, 'turnover')
}

function getPlayerSteals(match: Match, playerId: string) {
  return getPlayerStatByType(match, playerId, 'steals')
}

function getTeamScore(match: Match, playerIds: Array<string>) {
  return playerIds.reduce((score: number, playerId) => score + getPlayerScore(match, playerId), 0)
}

function isMatchHaveStatOfType(match: Match, statName: StatMatchActionItemName) {
  return Boolean(match.stats.find((statItem) => statItem.name === statName))
}

function getTeamScores(players: Array<StatMatchSummaryPlayer>) {
  const rawTeamScores = clone(RAW_STAT_MATCH_SUMMARY.teamScores) as StatMatchSummaryPlayer

  const teamScores = players.reduce((total, playerStat) => {
    total.scores.total += playerStat.scores.total
    total.scores['free-throw'] += playerStat.scores['free-throw']
    total.scores['2pts'] += playerStat.scores['2pts']
    total.scores['3pts'] += playerStat.scores['3pts']

    total.playTime = (total.playTime || 0) + (playerStat.playTime || 0)

    total.assists += playerStat.assists
    total.turnover += playerStat.turnover
    total.steals += playerStat.steals
    total.fouls += playerStat.fouls

    total.rebonds.total += playerStat.rebonds.total
    total.rebonds.offensive += playerStat.rebonds.offensive
    total.rebonds.defensive += playerStat.rebonds.defensive

    total.ratio['free-throw'].fail += playerStat.ratio['free-throw'].fail
    total.ratio['free-throw'].success += playerStat.ratio['free-throw'].success
    total.ratio['free-throw'].total += playerStat.ratio['free-throw'].total
    total.ratio['2pts'].fail += playerStat.ratio['2pts'].fail
    total.ratio['2pts'].success += playerStat.ratio['2pts'].success
    total.ratio['2pts'].total += playerStat.ratio['2pts'].total
    total.ratio['3pts'].fail += playerStat.ratio['3pts'].fail
    total.ratio['3pts'].success += playerStat.ratio['3pts'].success
    total.ratio['3pts'].total += playerStat.ratio['3pts'].total

    return total
  }, rawTeamScores)

  teamScores.ratio['free-throw'].percentage =
    Math.round((teamScores.ratio['free-throw'].success / teamScores.ratio['free-throw'].total) * 100) || 0

  teamScores.ratio['2pts'].percentage =
    Math.round((teamScores.ratio['2pts'].success / teamScores.ratio['2pts'].total) * 100) || 0

  teamScores.ratio['3pts'].percentage =
    Math.round((teamScores.ratio['3pts'].success / teamScores.ratio['3pts'].total) * 100) || 0

  return teamScores
}

function getTeamAssists(playersStats: StatMatchSummaryPlayer[]) {
  return playersStats.reduce((result, playerStats) => {
    return result + playerStats.assists
  }, 0)
}

function getTeamTurnovers(playersStats: StatMatchSummaryPlayer[]) {
  return playersStats.reduce((result, playerStats) => {
    return result + playerStats.turnover
  }, 0)
}

function getTeamSteals(playersStats: StatMatchSummaryPlayer[]) {
  return playersStats.reduce((result, playerStats) => {
    return result + playerStats.steals
  }, 0)
}

function getTeamFouls(playersStats: StatMatchSummaryPlayer[]) {
  return playersStats.reduce((result, playerStats) => {
    return result + playerStats.fouls
  }, 0)
}

function getPlayerNumberByType(
  match: Match,
  playerId: string,
  name: StatMatchActionItemName,
  type: StatMatchActionItemType,
) {
  return match.stats.reduce((score, statEntry) => {
    if (statEntry.playerId === playerId && statEntry.name === name && statEntry.type === type) {
      return score + 1
    }

    return score
  }, 0)
}

function getOpponentScore(match: Match) {
  return getPlayerScore(match, TEAM_OPPONENT_ID)
}

function getOpponentOffensiveRebonds(match: Match) {
  return getPlayerStatByType(match, TEAM_OPPONENT_ID, 'offensive-rebond')
}

function getOpponentDefensiveRebonds(match: Match) {
  return getPlayerStatByType(match, TEAM_OPPONENT_ID, 'defensive-rebond')
}

function getOpponentFouls(match: Match) {
  return getPlayerStatByType(match, TEAM_OPPONENT_ID, 'foul')
}

function getTeamDefensiveRebonds(match: Match, playerIds: Array<string>) {
  return playerIds.reduce((result, playerId) => {
    return result + getPlayerStatByType(match, playerId, 'defensive-rebond')
  }, 0)
}

function getTeamOffensiveRebonds(match: Match, playerIds: Array<string>) {
  return playerIds.reduce((result, playerId) => {
    return result + getPlayerStatByType(match, playerId, 'offensive-rebond')
  }, 0)
}

function getFullRebondStats(match: Match, playerIds: Array<string>): StatMatchSummaryRebonds {
  const opponentDefensive = getOpponentDefensiveRebonds(match)
  const opponentOffensive = getOpponentOffensiveRebonds(match)
  const opponentTotal = opponentDefensive + opponentOffensive

  const teamOffensive = getTeamOffensiveRebonds(match, playerIds)
  const teamDefensive = getTeamDefensiveRebonds(match, playerIds)
  const teamTotal = teamDefensive + teamOffensive

  const teamDefensivePercentage = Math.round((teamDefensive / (opponentOffensive + teamDefensive)) * 100) || 0
  const teamOffensivePercentage = Math.round((teamOffensive / (opponentDefensive + teamOffensive)) * 100) || 0
  const teamTotalPercentage = Math.round((teamDefensivePercentage + teamOffensivePercentage) / 2) || 0

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

function getPlayersStatsByMatch(match: Match) {
  const playerIds = getPlayerIdsInStats(match)
  return playerIds
    .map((playerId) => {
      const playerStats = {
        playerId,
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
            success: getPlayerNumberByType(match, playerId, 'free-throw', 'success'),
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
        steals: getPlayerSteals(match, playerId),
      }

      playerStats.scores.total =
        playerStats.scores['2pts'] + playerStats.scores['3pts'] + playerStats.scores['free-throw']

      playerStats.rebonds.total = playerStats.rebonds.offensive + playerStats.rebonds.defensive

      playerStats.ratio['2pts'].total = playerStats.ratio['2pts'].fail + playerStats.ratio['2pts'].success

      playerStats.ratio['2pts'].percentage =
        Math.round((playerStats.ratio['2pts'].success / playerStats.ratio['2pts'].total) * 100) || 0

      playerStats.ratio['3pts'].total = playerStats.ratio['3pts'].fail + playerStats.ratio['3pts'].success

      playerStats.ratio['3pts'].percentage =
        Math.round((playerStats.ratio['3pts'].success / playerStats.ratio['3pts'].total) * 100) || 0

      playerStats.ratio['free-throw'].total =
        playerStats.ratio['free-throw'].fail + playerStats.ratio['free-throw'].success

      playerStats.ratio['free-throw'].percentage =
        Math.round((playerStats.ratio['free-throw'].success / playerStats.ratio['free-throw'].total) * 100) || 0
      playerStats.scores['2pts'] + playerStats.scores['3pts'] + playerStats.scores['free-throw']

      playerStats.rebonds.total = playerStats.rebonds.offensive + playerStats.rebonds.defensive

      playerStats.ratio['2pts'].total = playerStats.ratio['2pts'].fail + playerStats.ratio['2pts'].success

      playerStats.ratio['2pts'].percentage =
        Math.round((playerStats.ratio['2pts'].success / playerStats.ratio['2pts'].total) * 100) || 0

      playerStats.ratio['3pts'].total = playerStats.ratio['3pts'].fail + playerStats.ratio['3pts'].success

      playerStats.ratio['3pts'].percentage =
        Math.round((playerStats.ratio['3pts'].success / playerStats.ratio['3pts'].total) * 100) || 0

      playerStats.ratio['free-throw'].total =
        playerStats.ratio['free-throw'].fail + playerStats.ratio['free-throw'].success

      playerStats.ratio['free-throw'].percentage =
        Math.round((playerStats.ratio['free-throw'].success / playerStats.ratio['free-throw'].total) * 100) || 0

      return playerStats as StatMatchSummaryPlayer
    })
    .sort((playerA, playerB) => playerB.rebonds.total - playerA.rebonds.total)
    .sort((playerA, playerB) => playerB.scores.total - playerA.scores.total)
}

function sumPlayerStats(
  statResult: StatMatchSummaryPlayer,
  statCurrentMatch: StatMatchSummaryPlayer,
): StatMatchSummaryPlayer {
  statResult.scores['free-throw'] += statCurrentMatch.scores['free-throw']
  statResult.scores['2pts'] += statCurrentMatch.scores['2pts']
  statResult.scores['3pts'] += statCurrentMatch.scores['3pts']
  statResult.scores.total += statCurrentMatch.scores.total

  statResult.rebonds.defensive += statCurrentMatch.rebonds.defensive
  statResult.rebonds.offensive += statCurrentMatch.rebonds.offensive
  statResult.rebonds.total += statCurrentMatch.rebonds.total

  statResult.ratio['free-throw'].success += statCurrentMatch.ratio['free-throw'].success
  statResult.ratio['free-throw'].fail += statCurrentMatch.ratio['free-throw'].fail
  statResult.ratio['free-throw'].total += statCurrentMatch.ratio['free-throw'].total

  statResult.ratio['2pts'].success += statCurrentMatch.ratio['2pts'].success
  statResult.ratio['2pts'].fail += statCurrentMatch.ratio['2pts'].fail
  statResult.ratio['2pts'].total += statCurrentMatch.ratio['2pts'].total

  statResult.ratio['3pts'].success += statCurrentMatch.ratio['3pts'].success
  statResult.ratio['3pts'].fail += statCurrentMatch.ratio['3pts'].fail
  statResult.ratio['3pts'].total += statCurrentMatch.ratio['3pts'].total

  statResult.fouls += statCurrentMatch.fouls
  statResult.turnover += statCurrentMatch.turnover
  statResult.steals += statCurrentMatch.steals
  statResult.assists += statCurrentMatch.assists

  return statResult
}

function dividePlayerStatsByNbMatch(playerSats: StatMatchSummaryPlayer) {
  if (!playerSats.nbPlayedMatch) {
    return playerSats
  }

  playerSats.fouls = (playerSats.fouls && Math.round(playerSats.fouls / playerSats.nbPlayedMatch)) || 0
  playerSats.assists = (playerSats.assists && Math.round(playerSats.assists / playerSats.nbPlayedMatch)) || 0

  playerSats.turnover = (playerSats.turnover && Math.round(playerSats.turnover / playerSats.nbPlayedMatch)) || 0
  playerSats.steals = (playerSats.steals && Math.round(playerSats.steals / playerSats.nbPlayedMatch)) || 0

  playerSats.scores.total =
    (playerSats.scores.total && Math.round(playerSats.scores.total / playerSats.nbPlayedMatch)) || 0

  playerSats.scores['2pts'] =
    (playerSats.scores['2pts'] && Math.round(playerSats.scores['2pts'] / playerSats.nbPlayedMatch)) || 0

  playerSats.scores['3pts'] =
    (playerSats.scores['3pts'] && Math.round(playerSats.scores['3pts'] / playerSats.nbPlayedMatch)) || 0

  playerSats.scores['free-throw'] =
    (playerSats.scores['free-throw'] && Math.round(playerSats.scores['free-throw'] / playerSats.nbPlayedMatch)) || 0

  playerSats.ratio['free-throw'].total =
    (playerSats.ratio['free-throw'].total &&
      Math.round(playerSats.ratio['free-throw'].total / playerSats.nbPlayedMatch)) ||
    0
  playerSats.ratio['free-throw'].success =
    (playerSats.ratio['free-throw'].success &&
      Math.round(playerSats.ratio['free-throw'].success / playerSats.nbPlayedMatch)) ||
    0
  playerSats.ratio['free-throw'].fail =
    (playerSats.ratio['free-throw'].fail &&
      Math.round(playerSats.ratio['free-throw'].fail / playerSats.nbPlayedMatch)) ||
    0

  playerSats.ratio['free-throw'].percentage =
    (playerSats.ratio['free-throw'].total &&
      Math.round((playerSats.ratio['free-throw'].success / playerSats.ratio['free-throw'].total) * 100)) ||
    0

  playerSats.ratio['2pts'].total =
    (playerSats.ratio['2pts'].total && Math.round(playerSats.ratio['2pts'].total / playerSats.nbPlayedMatch)) || 0
  playerSats.ratio['2pts'].success =
    (playerSats.ratio['2pts'].success && Math.round(playerSats.ratio['2pts'].success / playerSats.nbPlayedMatch)) || 0
  playerSats.ratio['2pts'].fail =
    (playerSats.ratio['2pts'].fail && Math.round(playerSats.ratio['2pts'].fail / playerSats.nbPlayedMatch)) || 0

  playerSats.ratio['2pts'].percentage =
    (playerSats.ratio['2pts'].total &&
      Math.round((playerSats.ratio['2pts'].success / playerSats.ratio['2pts'].total) * 100)) ||
    0

  playerSats.ratio['3pts'].total =
    (playerSats.ratio['3pts'].total && Math.round(playerSats.ratio['3pts'].total / playerSats.nbPlayedMatch)) || 0
  playerSats.ratio['3pts'].success =
    (playerSats.ratio['3pts'].success && Math.round(playerSats.ratio['3pts'].success / playerSats.nbPlayedMatch)) || 0
  playerSats.ratio['3pts'].fail =
    (playerSats.ratio['3pts'].fail && Math.round(playerSats.ratio['3pts'].fail / playerSats.nbPlayedMatch)) || 0

  playerSats.ratio['3pts'].percentage =
    (playerSats.ratio['3pts'].total &&
      Math.round((playerSats.ratio['3pts'].success / playerSats.ratio['3pts'].total) * 100)) ||
    0

  playerSats.rebonds.defensive =
    (playerSats.rebonds.defensive && Math.round(playerSats.rebonds.defensive / playerSats.nbPlayedMatch)) || 0
  playerSats.rebonds.offensive =
    (playerSats.rebonds.offensive && Math.round(playerSats.rebonds.offensive / playerSats.nbPlayedMatch)) || 0
  playerSats.rebonds.total = playerSats.rebonds.offensive + playerSats.rebonds.defensive

  return playerSats
}

export function getStatSummary(match: Match | null): StatMatchSummary {
  if (!match) {
    return clone(RAW_STAT_MATCH_SUMMARY) as StatMatchSummary
  }

  const playerIds = getPlayerIdsInStats(match)
  const players = getPlayersStatsByMatch(match)
  const rebonds = getFullRebondStats(match, playerIds)

  return {
    teamScore: getTeamScore(match, playerIds),
    teamScores: getTeamScores(players),
    opponentScore: getOpponentScore(match),
    opponentFouls: getOpponentFouls(match),
    players,
    rebonds,
    teamAssists: getTeamAssists(players),
    teamTurnover: getTeamTurnovers(players),
    teamSteals: getTeamSteals(players),
    teamFouls: getTeamFouls(players),
  }
}

export function getFullStats(): StatMatchSummary {
  // TODO:filter by tournament, date, team, etc.
  const matchs = orchestrator.Matchs.matchs

  // TODO: get team by argv
  const team = orchestrator.Teams.teams[0]

  const stats = matchs.map((match: Match) => {
    return getStatSummary(match)
  })

  const fullStats = stats.reduce((statResult: StatMatchSummary, statCurrentMatch: StatMatchSummary) => {
    statResult.opponentFouls += statCurrentMatch.opponentFouls

    statResult.opponentScore += statCurrentMatch.opponentScore

    statResult.teamScore += statCurrentMatch.teamScore

    statResult.rebonds.teamTotal += statCurrentMatch.rebonds.teamTotal

    statResult.rebonds.teamOffensive += statCurrentMatch.rebonds.teamOffensive

    statResult.rebonds.teamDefensive += statCurrentMatch.rebonds.teamDefensive

    statResult.rebonds.opponentTotal += statCurrentMatch.rebonds.opponentTotal

    statResult.rebonds.opponentOffensive += statCurrentMatch.rebonds.opponentOffensive

    statResult.rebonds.opponentDefensive += statCurrentMatch.rebonds.opponentDefensive

    sumPlayerStats(statResult.teamScores, statCurrentMatch.teamScores)

    return statResult
  }, clone(RAW_STAT_MATCH_SUMMARY) as StatMatchSummary)

  fullStats.players = team.playerIds.map((playerId: string): StatMatchSummaryPlayer => {
    const currentPlayerStats = clone(RAW_STAT_MATCH_SUMMARY.teamScores) as StatMatchSummaryPlayer

    currentPlayerStats.playerId = playerId

    for (const stat of stats) {
      for (const playerStats of stat.players) {
        if (playerStats.playerId !== playerId) {
          continue
        }

        sumPlayerStats(currentPlayerStats, playerStats)

        currentPlayerStats.nbPlayedMatch++
      }
    }

    dividePlayerStatsByNbMatch(currentPlayerStats)

    return currentPlayerStats
  })

  fullStats.players.sort((up, down) => down.scores.total - up.scores.total)

  const nbMatch = matchs.length

  fullStats.teamScore = Math.round(fullStats.teamScore / nbMatch)
  fullStats.opponentScore = Math.round(fullStats.opponentScore / nbMatch)
  fullStats.opponentFouls = Math.round(fullStats.opponentFouls / nbMatch)

  fullStats.rebonds.teamTotal = Math.round(fullStats.rebonds.teamTotal / nbMatch)
  fullStats.rebonds.teamOffensive = Math.round(fullStats.rebonds.teamOffensive / nbMatch)
  fullStats.rebonds.teamDefensive = Math.round(fullStats.rebonds.teamDefensive / nbMatch)
  fullStats.rebonds.opponentTotal = Math.round(fullStats.rebonds.opponentTotal / nbMatch)
  fullStats.rebonds.opponentOffensive = Math.round(fullStats.rebonds.opponentOffensive / nbMatch)
  fullStats.rebonds.opponentDefensive = Math.round(fullStats.rebonds.opponentDefensive / nbMatch)
  fullStats.rebonds.teamTotalPercentage = Math.round(
    (fullStats.rebonds.teamTotal / (fullStats.rebonds.teamTotal + fullStats.rebonds.opponentTotal)) * 100,
  )
  fullStats.rebonds.teamDefensivePercentage = Math.round(
    (fullStats.rebonds.teamDefensive / (fullStats.rebonds.teamDefensive + fullStats.rebonds.opponentDefensive)) * 100,
  )
  fullStats.rebonds.teamOffensivePercentage = Math.round(
    (fullStats.rebonds.teamOffensive / (fullStats.rebonds.teamOffensive + fullStats.rebonds.opponentOffensive)) * 100,
  )

  fullStats.teamScores.scores['free-throw'] = Math.round(fullStats.teamScores.scores['free-throw'] / nbMatch)
  fullStats.teamScores.scores['2pts'] = Math.round(fullStats.teamScores.scores['2pts'] / nbMatch)
  fullStats.teamScores.scores['3pts'] = Math.round(fullStats.teamScores.scores['3pts'] / nbMatch)
  fullStats.teamScores.scores.total = Math.round(fullStats.teamScores.scores.total / nbMatch)

  fullStats.teamScores.rebonds.defensive = Math.round(fullStats.teamScores.rebonds.defensive / nbMatch)
  fullStats.teamScores.rebonds.offensive = Math.round(fullStats.teamScores.rebonds.offensive / nbMatch)
  fullStats.teamScores.rebonds.total = Math.round(fullStats.teamScores.rebonds.total / nbMatch)

  fullStats.teamScores.ratio['free-throw'].success = Math.round(
    fullStats.teamScores.ratio['free-throw'].success / nbMatch,
  )

  fullStats.teamScores.ratio['free-throw'].fail = Math.round(fullStats.teamScores.ratio['free-throw'].fail / nbMatch)
  fullStats.teamScores.ratio['free-throw'].total = Math.round(fullStats.teamScores.ratio['free-throw'].total / nbMatch)
  fullStats.teamScores.ratio['free-throw'].percentage = Math.round(
    (fullStats.teamScores.ratio['free-throw'].success / fullStats.teamScores.ratio['free-throw'].total) * 100,
  )

  fullStats.teamScores.ratio['2pts'].success = Math.round(fullStats.teamScores.ratio['2pts'].success / nbMatch)
  fullStats.teamScores.ratio['2pts'].fail = Math.round(fullStats.teamScores.ratio['2pts'].fail / nbMatch)
  fullStats.teamScores.ratio['2pts'].total = Math.round(fullStats.teamScores.ratio['2pts'].total / nbMatch)
  fullStats.teamScores.ratio['2pts'].percentage = Math.round(
    (fullStats.teamScores.ratio['2pts'].success / fullStats.teamScores.ratio['2pts'].total) * 100,
  )

  fullStats.teamScores.ratio['3pts'].success = Math.round(fullStats.teamScores.ratio['3pts'].success / nbMatch)
  fullStats.teamScores.ratio['3pts'].fail = Math.round(fullStats.teamScores.ratio['3pts'].fail / nbMatch)
  fullStats.teamScores.ratio['3pts'].total = Math.round(fullStats.teamScores.ratio['3pts'].total / nbMatch)
  fullStats.teamScores.ratio['3pts'].percentage = Math.round(
    (fullStats.teamScores.ratio['3pts'].success / fullStats.teamScores.ratio['3pts'].total) * 100,
  )

  // Fouls, turnover, steals and assists was not registered on the first matchs.
  const nbMatchFouls = matchs.filter((match) => isMatchHaveStatOfType(match, 'foul')).length
  const nbMatchTurnover = matchs.filter((match) => isMatchHaveStatOfType(match, 'turnover')).length
  const nbMatchSteals = matchs.filter((match) => isMatchHaveStatOfType(match, 'steals')).length
  const nbMatchAssists = matchs.filter((match) => isMatchHaveStatOfType(match, 'assist')).length

  fullStats.teamScores.fouls = Math.round(fullStats.teamScores.fouls / nbMatchFouls)
  fullStats.teamScores.turnover = Math.round(fullStats.teamScores.turnover / nbMatchTurnover)
  fullStats.teamScores.steals = Math.round(fullStats.teamScores.steals / nbMatchSteals)
  fullStats.teamScores.assists = Math.round(fullStats.teamScores.assists / nbMatchAssists)

  return fullStats
}
