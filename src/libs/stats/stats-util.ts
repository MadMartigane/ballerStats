import type Match from '../match/match'
import orchestrator from '../orchestrator/orchestrator'
import { TEAM_OPPONENT_ID } from '../team/team'
import { clone } from '../utils/utils'
import type {
  FullStatSummary,
  StatMatchActionItemName,
  StatMatchActionItemType,
  StatMatchSummary,
  StatMatchSummaryPlayer,
  StatMatchSummaryRatio,
  StatMatchSummaryRebonds,
} from './stats.d'

export type MatchOutcome = 'win' | 'loss' | 'tie' | 'none'

export function getMatchOutcome(match: Match): { result: MatchOutcome; teamScore: number; opponentScore: number } {
  if (match.stats.length === 0) {
    return { opponentScore: 0, result: 'none', teamScore: 0 }
  }
  const { teamScore, opponentScore } = getStatSummary(match)
  // biome-ignore lint/style/noNestedTernary: ternary is required by audit finding P1-1 instead of let/if-else.
  const result: MatchOutcome = teamScore > opponentScore ? 'win' : teamScore < opponentScore ? 'loss' : 'tie'
  return { opponentScore, result, teamScore }
}

/** Standard factor for converting free-throw attempts to shooting possessions (NBA TS% formula) */
const FREE_THROW_ATTEMPT_FACTOR = 0.44
/** Points-per-possession normalizer in TS% formula */
const POINTS_PER_POSSESSION = 2

/** Sentinel playerId marking the per-game team aggregate row. */
export const TEAM_PER_GAME_ID = '__TEAM_PER_GAME__'
/** Sentinel playerId marking the cumulative team totals row. */
export const TEAM_TOTAL_ID = '__TEAM_TOTAL__'

/** Returns true when the stats row is the per-game team aggregate row. */
export function isTeamPerGameRow(stats: StatMatchSummaryPlayer): boolean {
  return stats.playerId === TEAM_PER_GAME_ID
}

/** Returns true when the stats row is the cumulative team totals row. */
export function isTeamTotalRow(stats: StatMatchSummaryPlayer): boolean {
  return stats.playerId === TEAM_TOTAL_ID
}

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

  return { astToRatio, eff, trueShootingPercentage }
}

/** Apply derived stats (EFF, AST/TO, TS%) directly onto a target stat object. */
function applyDerivedStats(target: StatMatchSummaryPlayer): void {
  Object.assign(target, computeDerivedStats(target))
}

/** Recompute all ratios' percentages and derived stats on a fully-populated team row. */
function finalizeTeamScores(team: StatMatchSummaryPlayer): void {
  recomputeRatioPercentage(team.ratio['2pts'])
  recomputeRatioPercentage(team.ratio['3pts'])
  recomputeRatioPercentage(team.ratio['free-throw'])
  applyDerivedStats(team)
}

/**
 * Divide every volume field of a team row by a divisor and recompute derived stats.
 * The rebonds.total is divided directly (not summed from defensive + offensive) to
 * avoid double-rounding drift.
 */
function divideTeamScoresBy(team: StatMatchSummaryPlayer, divisor: number): void {
  // Capture the raw total first: dividePlayerStatsBy recomputes total as offensive + defensive.
  const rawRebondsTotal = team.rebonds.total
  dividePlayerStatsBy(team, divisor)
  // Team total is divided directly (not summed) to avoid double-rounding drift.
  // Accepted trade-off: on the per-game team row, rebonds.total may differ by ±1 from
  // (offensive + defensive) as displayed, because each component rounds independently.
  // The headline total stays numerically honest vs. the totals row.
  team.rebonds.total = safeDivide(rawRebondsTotal, divisor)
}

/** Clones the per-game team row into a totals row, stamping both sentinel playerIds.
 *  Returns the totals-row clone; the source is marked as the per-game row. */
function markTeamRowPair(perGame: StatMatchSummaryPlayer): StatMatchSummaryPlayer {
  const totals = clone(perGame) as StatMatchSummaryPlayer
  totals.playerId = TEAM_TOTAL_ID
  perGame.playerId = TEAM_PER_GAME_ID
  return totals
}

/** Rate stats (percentages, AST/TO, TS%) are aggregation-invariant: the RFC requires them
 *  identical on both team rows, computed from the RAW TOTALS. After per-game division,
 *  recomputing them from rounded per-game counts would diverge — restore them from the
 *  totals row instead. */
function restoreInvariantRates(perGame: StatMatchSummaryPlayer, totals: StatMatchSummaryPlayer): void {
  perGame.ratio['2pts'].percentage = totals.ratio['2pts'].percentage
  perGame.ratio['3pts'].percentage = totals.ratio['3pts'].percentage
  perGame.ratio['free-throw'].percentage = totals.ratio['free-throw'].percentage
  perGame.astToRatio = totals.astToRatio
  perGame.trueShootingPercentage = totals.trueShootingPercentage
}

const RAW_STAT_MATCH_SUMMARY: StatMatchSummary = {
  opponentFouls: 0,
  opponentScore: 0,
  players: [],
  rebonds: {
    opponentDefensive: 0,
    opponentOffensive: 0,
    opponentTotal: 0,
    teamDefensive: 0,
    teamDefensivePercentage: 0,
    teamOffensive: 0,
    teamOffensivePercentage: 0,
    teamTotal: 0,
    teamTotalPercentage: 0,
  },
  teamAssists: 0,
  teamFouls: 0,
  teamScore: 0,
  teamScores: {
    assists: 0,
    astToRatio: 0,
    blocks: 0,
    eff: 0,
    fouls: 0,
    nbPlayedMatch: 0,
    playerId: '',
    playTime: 0,
    ratio: {
      '2pts': {
        fail: 0,
        percentage: 0,
        success: 0,
        total: 0,
      },
      '3pts': {
        fail: 0,
        percentage: 0,
        success: 0,
        total: 0,
      },
      'free-throw': {
        fail: 0,
        percentage: 0,
        success: 0,
        total: 0,
      },
    },
    rebonds: {
      defensive: 0,
      offensive: 0,
      total: 0,
    },
    scores: {
      '2pts': 0,
      '3pts': 0,
      'free-throw': 0,
      total: 0,
    },
    steals: 0,
    trueShootingPercentage: 0,
    turnover: 0,
  },
  teamSteals: 0,
  teamTurnover: 0,
}

function getPlayerIdsInStats(match: Match) {
  return match.stats
    .filter((stats) => stats.playerId !== TEAM_OPPONENT_ID)
    .map((stats) => stats.playerId)
    .reduce((result, playerId) => {
      if (!playerId || result.includes(playerId)) {
        return result
      }

      result.push(playerId)
      return result
    }, [] as string[])
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

function getTeamScore(match: Match, playerIds: string[]) {
  return playerIds.reduce((score: number, playerId) => score + getPlayerScore(match, playerId), 0)
}

function getTeamScores(players: StatMatchSummaryPlayer[]) {
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

  finalizeTeamScores(teamScores)

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

function getTeamDefensiveRebonds(match: Match, playerIds: string[]) {
  return playerIds.reduce((result, playerId) => result + getPlayerStatByType(match, playerId, 'defensive-rebond'), 0)
}

function getTeamOffensiveRebonds(match: Match, playerIds: string[]) {
  return playerIds.reduce((result, playerId) => result + getPlayerStatByType(match, playerId, 'offensive-rebond'), 0)
}

function getFullRebondStats(match: Match, playerIds: string[]): StatMatchSummaryRebonds {
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
    opponentDefensive,
    opponentOffensive,
    opponentTotal,
    teamDefensive,
    teamDefensivePercentage,
    teamOffensive,
    teamOffensivePercentage,
    teamTotal,
    teamTotalPercentage,
  }
}

function getPlayersStatsByMatch(match: Match) {
  const playerIds = getPlayerIdsInStats(match)
  return playerIds
    .map((playerId) => {
      const playerStats = {
        assists: getPlayerAssists(match, playerId),
        blocks: getPlayerBlocks(match, playerId),
        fouls: getPlayerFouls(match, playerId),
        playerId,
        ratio: {
          '2pts': {
            fail: getPlayerNumberByType(match, playerId, '2pts', 'error'),
            percentage: 0,
            success: getPlayerNumberByType(match, playerId, '2pts', 'success'),
            total: 0,
          },
          '3pts': {
            fail: getPlayerNumberByType(match, playerId, '3pts', 'error'),
            percentage: 0,
            success: getPlayerNumberByType(match, playerId, '3pts', 'success'),
            total: 0,
          },
          'free-throw': {
            fail: getPlayerNumberByType(match, playerId, 'free-throw', 'error'),
            percentage: 0,
            success: getPlayerNumberByType(match, playerId, 'free-throw', 'success'),
            total: 0,
          },
        },
        rebonds: {
          defensive: getPlayerDefensiveRebonds(match, playerId),
          offensive: getPlayerOffensiveRebonds(match, playerId),
          total: 0,
        },
        scores: {
          '2pts': getPlayerStatByType(match, playerId, '2pts'),
          '3pts': getPlayerStatByType(match, playerId, '3pts'),
          'free-throw': getPlayerStatByType(match, playerId, 'free-throw'),
          total: 0,
        },
        steals: getPlayerSteals(match, playerId),
        turnover: getPlayerTurnovers(match, playerId),
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

/** Divide every per-game field of a player row by a divisor.
 *  rebonds.total is recomputed as the sum of the already-divided defensive + offensive
 *  components (rather than divided directly) to stay consistent with the per-match shape. */
function dividePlayerStatsBy(playerSats: StatMatchSummaryPlayer, divisor: number): void {
  playerSats.fouls = safeDivide(playerSats.fouls, divisor)
  playerSats.assists = safeDivide(playerSats.assists, divisor)
  playerSats.blocks = safeDivide(playerSats.blocks, divisor)

  playerSats.turnover = safeDivide(playerSats.turnover, divisor)
  playerSats.steals = safeDivide(playerSats.steals, divisor)

  playerSats.scores.total = safeDivide(playerSats.scores.total, divisor)

  playerSats.scores['2pts'] = safeDivide(playerSats.scores['2pts'], divisor)

  playerSats.scores['3pts'] = safeDivide(playerSats.scores['3pts'], divisor)

  playerSats.scores['free-throw'] = safeDivide(playerSats.scores['free-throw'], divisor)

  divideRatioBy(playerSats.ratio['2pts'], divisor)
  divideRatioBy(playerSats.ratio['3pts'], divisor)
  divideRatioBy(playerSats.ratio['free-throw'], divisor)

  playerSats.rebonds.defensive = safeDivide(playerSats.rebonds.defensive, divisor)
  playerSats.rebonds.offensive = safeDivide(playerSats.rebonds.offensive, divisor)
  playerSats.rebonds.total = playerSats.rebonds.offensive + playerSats.rebonds.defensive
}

function dividePlayerStatsByNbMatch(playerSats: StatMatchSummaryPlayer) {
  if (!playerSats.nbPlayedMatch) {
    return playerSats
  }

  dividePlayerStatsBy(playerSats, playerSats.nbPlayedMatch)

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
    opponentFouls: getOpponentFouls(match),
    opponentScore: getOpponentScore(match),
    players,
    rebonds,
    teamAssists: getTeamAssists(players),
    teamFouls: getTeamFouls(players),
    teamScore: getTeamScore(match, playerIds),
    teamScores,
    teamSteals: getTeamSteals(players),
    teamTurnover: getTeamTurnovers(players),
  }
}

export function getFullStats(championshipFilter?: string): FullStatSummary {
  const allMatchs = orchestrator.Matchs.matchs
  const matchs = championshipFilter ? allMatchs.filter((m) => m.championship === championshipFilter) : allMatchs

  if (matchs.length === 0) {
    const base = clone(RAW_STAT_MATCH_SUMMARY) as StatMatchSummary
    const teamScoresTotal = markTeamRowPair(base.teamScores)
    return { ...base, teamScoresTotal }
  }

  // TODO: get team by argv
  const [team] = orchestrator.Teams.teams

  const stats = matchs.map((match: Match) => getStatSummary(match))

  const summed = clone(RAW_STAT_MATCH_SUMMARY) as StatMatchSummary

  for (const statCurrentMatch of stats) {
    summed.opponentFouls += statCurrentMatch.opponentFouls

    summed.opponentScore += statCurrentMatch.opponentScore

    summed.teamScore += statCurrentMatch.teamScore

    summed.rebonds.teamTotal += statCurrentMatch.rebonds.teamTotal

    summed.rebonds.teamOffensive += statCurrentMatch.rebonds.teamOffensive

    summed.rebonds.teamDefensive += statCurrentMatch.rebonds.teamDefensive

    summed.rebonds.opponentTotal += statCurrentMatch.rebonds.opponentTotal

    summed.rebonds.opponentOffensive += statCurrentMatch.rebonds.opponentOffensive

    summed.rebonds.opponentDefensive += statCurrentMatch.rebonds.opponentDefensive

    sumPlayerStats(summed.teamScores, statCurrentMatch.teamScores)
  }

  // Resolve ids at the lookup site so tombstoned/missing players never appear as rows.
  summed.players = team.playerIds
    .filter((playerId: string) => orchestrator.getPlayer(playerId))
    .map((playerId: string): StatMatchSummaryPlayer => {
      const currentPlayerStats = clone(RAW_STAT_MATCH_SUMMARY.teamScores) as StatMatchSummaryPlayer

      currentPlayerStats.playerId = playerId

      for (const stat of stats) {
        for (const playerStats of stat.players) {
          if (playerStats.playerId !== playerId) {
            continue
          }

          sumPlayerStats(currentPlayerStats, playerStats)

          currentPlayerStats.nbPlayedMatch += 1
        }
      }

      dividePlayerStatsByNbMatch(currentPlayerStats)
      applyDerivedStats(currentPlayerStats)

      return currentPlayerStats
    })

  summed.players.sort((up, down) => down.scores.total - up.scores.total)

  const nbMatch = matchs.length

  summed.teamScore = safeDivide(summed.teamScore, nbMatch)
  summed.opponentScore = safeDivide(summed.opponentScore, nbMatch)
  summed.opponentFouls = safeDivide(summed.opponentFouls, nbMatch)

  summed.rebonds.teamTotal = safeDivide(summed.rebonds.teamTotal, nbMatch)
  summed.rebonds.teamOffensive = safeDivide(summed.rebonds.teamOffensive, nbMatch)
  summed.rebonds.teamDefensive = safeDivide(summed.rebonds.teamDefensive, nbMatch)
  summed.rebonds.opponentTotal = safeDivide(summed.rebonds.opponentTotal, nbMatch)
  summed.rebonds.opponentOffensive = safeDivide(summed.rebonds.opponentOffensive, nbMatch)
  summed.rebonds.opponentDefensive = safeDivide(summed.rebonds.opponentDefensive, nbMatch)
  summed.rebonds.teamTotalPercentage = safePercentage(
    summed.rebonds.teamTotal,
    summed.rebonds.teamTotal + summed.rebonds.opponentTotal
  )
  summed.rebonds.teamDefensivePercentage = safePercentage(
    summed.rebonds.teamDefensive,
    summed.rebonds.teamDefensive + summed.rebonds.opponentDefensive
  )
  summed.rebonds.teamOffensivePercentage = safePercentage(
    summed.rebonds.teamOffensive,
    summed.rebonds.teamOffensive + summed.rebonds.opponentOffensive
  )

  // 1. Finalize the raw summed team row once so percentages and derived stats reflect totals.
  finalizeTeamScores(summed.teamScores)

  // 2. Clone the finalized row into the totals-row clone and stamp both sentinel playerIds.
  //    Stamping TEAM_PER_GAME_ID on the source here is safe: division math is independent of playerId.
  const teamScoresTotal = markTeamRowPair(summed.teamScores)

  // 3. Divide the per-game row uniformly by nbMatch, then re-apply derived stats.
  // RFC-STATS-TEAM-DUAL-ROW §2.4: legacy per-stat-type divisors (nbMatchFouls,
  // nbMatchTurnover, nbMatchSteals, nbMatchAssists, nbMatchBlocks) and
  // isMatchHaveStatOfType were intentionally removed — new season, uniform data.
  divideTeamScoresBy(summed.teamScores, nbMatch)
  applyDerivedStats(summed.teamScores)
  // Rate stats (percentages, AST/TO, TS%) are aggregation-invariant: recomputing
  // them from rounded per-game counts would diverge from the totals row, so we
  // restore them from the totals row after the derived-stats recompute. EFF is
  // a volume stat and stays recomputed from the divided values.
  restoreInvariantRates(summed.teamScores, teamScoresTotal)

  return { ...summed, teamScoresTotal }
}
