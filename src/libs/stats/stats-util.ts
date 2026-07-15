import type Match from '../match'
import orchestrator from '../orchestrator/orchestrator'
import { TEAM_OPPONENT_ID } from '../team/team'
import { clone } from '../utils'
import type {
  StatMatchActionItemName,
  StatMatchActionItemType,
  StatMatchSummary,
  StatMatchSummaryPlayer,
  StatMatchSummaryRatio,
  StatMatchSummaryRebonds,
} from './stats.d'

/** Standard factor for converting free-throw attempts to shooting possessions (NBA TS% formula) */
const FREE_THROW_ATTEMPT_FACTOR = 0.44
/** Points-per-possession normalizer in TS% formula */
const POINTS_PER_POSSESSION = 2

/**
 * Division that never produces NaN or Infinity.
 * Returns Math.round(numerator / denominator), or 0 when denominator === 0.
 * All inputs are finite stat counts, so the result is always finite.
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0
  }
  return Math.round(numerator / denominator)
}

/**
 * Percentage that never produces NaN or Infinity.
 * Returns Math.round((success / total) * 100), or 0 when total === 0.
 */
export function safePercentage(success: number, total: number): number {
  if (total === 0) {
    return 0
  }
  return Math.round((success / total) * 100)
}

/** Divide every field of a ratio by a divisor and recompute its percentage. */
function divideRatioBy(ratio: StatMatchSummaryRatio, divisor: number): void {
  ratio.total = safeDivide(ratio.total, divisor)
  ratio.success = safeDivide(ratio.success, divisor)
  ratio.fail = safeDivide(ratio.fail, divisor)
  recomputeRatioPercentage(ratio)
}

/** Recompute a ratio's percentage from its success and total counts. */
function recomputeRatioPercentage(ratio: StatMatchSummaryRatio): void {
  ratio.percentage = safePercentage(ratio.success, ratio.total)
}

/** Finalize a ratio by setting its total from success + fail and recomputing its percentage. */
function finalizeRatio(ratio: StatMatchSummaryRatio): void {
  ratio.total = ratio.success + ratio.fail
  recomputeRatioPercentage(ratio)
}

/**
 * Derive EFF, AST/TO and TS% from a fully-populated player/team stat object.
 * MUST run after scores, rebonds, ratios, blocks, assists, steals, turnover are final.
 * Returns a pure object with the derived stats.
 */
export function computeDerivedStats(player: StatMatchSummaryPlayer): {
  eff: number
  astToRatio: number
  trueShootingPercentage: number
} {
  const points = player.scores.total
  const fga = player.ratio['2pts'].total + player.ratio['3pts'].total
  const fta = player.ratio['free-throw'].total
  const missedFg = player.ratio['2pts'].fail + player.ratio['3pts'].fail
  const missedFt = player.ratio['free-throw'].fail

  // EFF = PTS + REB + AST + STL + BLK − MissedFG − MissedFT − TO
  const eff =
    points +
    player.rebonds.total +
    player.assists +
    player.steals +
    player.blocks -
    missedFg -
    missedFt -
    player.turnover

  // AST/TO: 1-decimal precision. When TO === 0, ratio equals assists.
  const astToRatio = player.turnover === 0 ? player.assists : Math.round((player.assists / player.turnover) * 10) / 10

  // TS% = PTS / (2 × (FGA + 0.44 × FTA)) × 100
  const trueShootingPercentage = safePercentage(points, POINTS_PER_POSSESSION * (fga + FREE_THROW_ATTEMPT_FACTOR * fta))

  return { eff, astToRatio, trueShootingPercentage }
}

/** Apply derived stats (EFF, AST/TO, TS%) directly onto a target stat object. */
function applyDerivedStats(target: StatMatchSummaryPlayer): void {
  Object.assign(target, computeDerivedStats(target))
}

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
    blocks: 0,
    eff: 0,
    astToRatio: 0,
    trueShootingPercentage: 0,
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
      [] as Array<string>
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

function getPlayerBlocks(match: Match, playerId: string) {
  return getPlayerStatByType(match, playerId, 'block')
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
    total.blocks += playerStat.blocks

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

  recomputeRatioPercentage(teamScores.ratio['free-throw'])
  recomputeRatioPercentage(teamScores.ratio['2pts'])
  recomputeRatioPercentage(teamScores.ratio['3pts'])

  applyDerivedStats(teamScores)

  return teamScores
}

function getTeamAssists(playersStats: StatMatchSummaryPlayer[]) {
  return playersStats.reduce((result, playerStats) => result + playerStats.assists, 0)
}

function getTeamTurnovers(playersStats: StatMatchSummaryPlayer[]) {
  return playersStats.reduce((result, playerStats) => result + playerStats.turnover, 0)
}

function getTeamSteals(playersStats: StatMatchSummaryPlayer[]) {
  return playersStats.reduce((result, playerStats) => result + playerStats.steals, 0)
}

function getTeamFouls(playersStats: StatMatchSummaryPlayer[]) {
  return playersStats.reduce((result, playerStats) => result + playerStats.fouls, 0)
}

function getPlayerNumberByType(
  match: Match,
  playerId: string,
  name: StatMatchActionItemName,
  type: StatMatchActionItemType
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
  return playerIds.reduce((result, playerId) => result + getPlayerStatByType(match, playerId, 'defensive-rebond'), 0)
}

function getTeamOffensiveRebonds(match: Match, playerIds: Array<string>) {
  return playerIds.reduce((result, playerId) => result + getPlayerStatByType(match, playerId, 'offensive-rebond'), 0)
}

function getFullRebondStats(match: Match, playerIds: Array<string>): StatMatchSummaryRebonds {
  const opponentDefensive = getOpponentDefensiveRebonds(match)
  const opponentOffensive = getOpponentOffensiveRebonds(match)
  const opponentTotal = opponentDefensive + opponentOffensive

  const teamOffensive = getTeamOffensiveRebonds(match, playerIds)
  const teamDefensive = getTeamDefensiveRebonds(match, playerIds)
  const teamTotal = teamDefensive + teamOffensive

  const teamDefensivePercentage = safePercentage(teamDefensive, opponentOffensive + teamDefensive)
  const teamOffensivePercentage = safePercentage(teamOffensive, opponentDefensive + teamOffensive)
  const teamTotalPercentage = safeDivide(teamDefensivePercentage + teamOffensivePercentage, 2)

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
        blocks: getPlayerBlocks(match, playerId),
      }

      playerStats.scores.total =
        playerStats.scores['2pts'] + playerStats.scores['3pts'] + playerStats.scores['free-throw']

      playerStats.rebonds.total = playerStats.rebonds.offensive + playerStats.rebonds.defensive

      finalizeRatio(playerStats.ratio['2pts'])
      finalizeRatio(playerStats.ratio['3pts'])
      finalizeRatio(playerStats.ratio['free-throw'])

      applyDerivedStats(playerStats as StatMatchSummaryPlayer)
      return playerStats as StatMatchSummaryPlayer
    })
    .sort((playerA, playerB) => playerB.rebonds.total - playerA.rebonds.total)
    .sort((playerA, playerB) => playerB.scores.total - playerA.scores.total)
}

function sumPlayerStats(
  statResult: StatMatchSummaryPlayer,
  statCurrentMatch: StatMatchSummaryPlayer
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
  statResult.blocks += statCurrentMatch.blocks

  return statResult
}

function dividePlayerStatsByNbMatch(playerSats: StatMatchSummaryPlayer) {
  if (!playerSats.nbPlayedMatch) {
    return playerSats
  }

  playerSats.fouls = safeDivide(playerSats.fouls, playerSats.nbPlayedMatch)
  playerSats.assists = safeDivide(playerSats.assists, playerSats.nbPlayedMatch)
  playerSats.blocks = safeDivide(playerSats.blocks, playerSats.nbPlayedMatch)

  playerSats.turnover = safeDivide(playerSats.turnover, playerSats.nbPlayedMatch)
  playerSats.steals = safeDivide(playerSats.steals, playerSats.nbPlayedMatch)

  playerSats.scores.total = safeDivide(playerSats.scores.total, playerSats.nbPlayedMatch)

  playerSats.scores['2pts'] = safeDivide(playerSats.scores['2pts'], playerSats.nbPlayedMatch)

  playerSats.scores['3pts'] = safeDivide(playerSats.scores['3pts'], playerSats.nbPlayedMatch)

  playerSats.scores['free-throw'] = safeDivide(playerSats.scores['free-throw'], playerSats.nbPlayedMatch)

  divideRatioBy(playerSats.ratio['2pts'], playerSats.nbPlayedMatch)
  divideRatioBy(playerSats.ratio['3pts'], playerSats.nbPlayedMatch)
  divideRatioBy(playerSats.ratio['free-throw'], playerSats.nbPlayedMatch)

  playerSats.rebonds.defensive = safeDivide(playerSats.rebonds.defensive, playerSats.nbPlayedMatch)
  playerSats.rebonds.offensive = safeDivide(playerSats.rebonds.offensive, playerSats.nbPlayedMatch)
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
  const teamScores = getTeamScores(players)

  return {
    teamScore: getTeamScore(match, playerIds),
    teamScores,
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

  if (matchs.length === 0) {
    return clone(RAW_STAT_MATCH_SUMMARY) as StatMatchSummary
  }

  // TODO: get team by argv
  const team = orchestrator.Teams.teams[0]

  const stats = matchs.map((match: Match) => getStatSummary(match))

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
    applyDerivedStats(currentPlayerStats)

    return currentPlayerStats
  })

  fullStats.players.sort((up, down) => down.scores.total - up.scores.total)

  const nbMatch = matchs.length

  fullStats.teamScore = safeDivide(fullStats.teamScore, nbMatch)
  fullStats.opponentScore = safeDivide(fullStats.opponentScore, nbMatch)
  fullStats.opponentFouls = safeDivide(fullStats.opponentFouls, nbMatch)

  fullStats.rebonds.teamTotal = safeDivide(fullStats.rebonds.teamTotal, nbMatch)
  fullStats.rebonds.teamOffensive = safeDivide(fullStats.rebonds.teamOffensive, nbMatch)
  fullStats.rebonds.teamDefensive = safeDivide(fullStats.rebonds.teamDefensive, nbMatch)
  fullStats.rebonds.opponentTotal = safeDivide(fullStats.rebonds.opponentTotal, nbMatch)
  fullStats.rebonds.opponentOffensive = safeDivide(fullStats.rebonds.opponentOffensive, nbMatch)
  fullStats.rebonds.opponentDefensive = safeDivide(fullStats.rebonds.opponentDefensive, nbMatch)
  fullStats.rebonds.teamTotalPercentage = safePercentage(
    fullStats.rebonds.teamTotal,
    fullStats.rebonds.teamTotal + fullStats.rebonds.opponentTotal
  )
  fullStats.rebonds.teamDefensivePercentage = safePercentage(
    fullStats.rebonds.teamDefensive,
    fullStats.rebonds.teamDefensive + fullStats.rebonds.opponentDefensive
  )
  fullStats.rebonds.teamOffensivePercentage = safePercentage(
    fullStats.rebonds.teamOffensive,
    fullStats.rebonds.teamOffensive + fullStats.rebonds.opponentOffensive
  )

  fullStats.teamScores.scores['free-throw'] = safeDivide(fullStats.teamScores.scores['free-throw'], nbMatch)
  fullStats.teamScores.scores['2pts'] = safeDivide(fullStats.teamScores.scores['2pts'], nbMatch)
  fullStats.teamScores.scores['3pts'] = safeDivide(fullStats.teamScores.scores['3pts'], nbMatch)
  fullStats.teamScores.scores.total = safeDivide(fullStats.teamScores.scores.total, nbMatch)

  fullStats.teamScores.rebonds.defensive = safeDivide(fullStats.teamScores.rebonds.defensive, nbMatch)
  fullStats.teamScores.rebonds.offensive = safeDivide(fullStats.teamScores.rebonds.offensive, nbMatch)
  fullStats.teamScores.rebonds.total = safeDivide(fullStats.teamScores.rebonds.total, nbMatch)

  divideRatioBy(fullStats.teamScores.ratio['2pts'], nbMatch)
  divideRatioBy(fullStats.teamScores.ratio['3pts'], nbMatch)
  divideRatioBy(fullStats.teamScores.ratio['free-throw'], nbMatch)

  // Fouls, turnover, steals and assists was not registered on the first matchs.
  const nbMatchFouls = matchs.filter((match) => isMatchHaveStatOfType(match, 'foul')).length
  const nbMatchTurnover = matchs.filter((match) => isMatchHaveStatOfType(match, 'turnover')).length
  const nbMatchSteals = matchs.filter((match) => isMatchHaveStatOfType(match, 'steals')).length
  const nbMatchAssists = matchs.filter((match) => isMatchHaveStatOfType(match, 'assist')).length
  const nbMatchBlocks = matchs.filter((match) => isMatchHaveStatOfType(match, 'block')).length

  fullStats.teamScores.fouls = safeDivide(fullStats.teamScores.fouls, nbMatchFouls)
  fullStats.teamScores.blocks = safeDivide(fullStats.teamScores.blocks, nbMatchBlocks)
  fullStats.teamScores.turnover = safeDivide(fullStats.teamScores.turnover, nbMatchTurnover)
  fullStats.teamScores.steals = safeDivide(fullStats.teamScores.steals, nbMatchSteals)
  fullStats.teamScores.assists = safeDivide(fullStats.teamScores.assists, nbMatchAssists)

  applyDerivedStats(fullStats.teamScores)

  return fullStats
}
