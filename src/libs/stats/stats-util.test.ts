import { describe, expect, it, vi } from 'vitest'
import type Match from '../match'
import { makeMatch } from '../mock/factories/match.factory'
import { makeStatEntry } from '../mock/factories/stat-entry.factory'
import { makeTeam } from '../mock/factories/team.factory'
import type Team from '../team'
import { TEAM_OPPONENT_ID } from '../team/team'
import type { StatMatchSummaryPlayer } from './stats.d'
import { computeDerivedStats, getFullStats, getStatSummary, safeDivide, safePercentage } from './stats-util'

const { mockOrchestrator } = vi.hoisted(() => ({
  mockOrchestrator: {
    Matchs: { matchs: [] as Match[] },
    Teams: { teams: [] as Team[] },
  },
}))

vi.mock('../orchestrator/orchestrator', () => ({
  default: mockOrchestrator,
}))

describe('safeDivide', () => {
  it('returns 0 for zero denominator (no NaN/Infinity)', () => {
    expect(safeDivide(10, 0)).toBe(0)
    expect(safeDivide(0, 0)).toBe(0)
  })
  it('rounds to nearest integer', () => {
    expect(safeDivide(10, 3)).toBe(3)
    expect(safeDivide(7, 2)).toBe(4)
  })
  it('preserves legitimate zero', () => {
    expect(safeDivide(0, 5)).toBe(0)
  })
})

describe('safePercentage', () => {
  it('returns 0 for zero total', () => {
    expect(safePercentage(5, 0)).toBe(0)
    expect(safePercentage(0, 0)).toBe(0)
  })
  it('computes and rounds percentage', () => {
    expect(safePercentage(1, 3)).toBe(33)
    expect(safePercentage(2, 5)).toBe(40)
  })
})

describe('getStatSummary', () => {
  it('returns a zeroed summary for null', () => {
    const summary = getStatSummary(null)

    expect(summary.teamScore).toBe(0)
    expect(summary.opponentScore).toBe(0)
    expect(summary.opponentFouls).toBe(0)
    expect(summary.teamScores.blocks).toBe(0)
    expect(summary.teamScores.eff).toBe(0)
    expect(summary.teamScores.astToRatio).toBe(0)
    expect(summary.teamScores.trueShootingPercentage).toBe(0)
    expect(summary.players).toEqual([])
    expect(summary.rebonds.teamTotal).toBe(0)
    expect(summary.rebonds.opponentTotal).toBe(0)
  })

  it('returns a zeroed summary for an empty match', () => {
    const summary = getStatSummary(makeMatch())

    expect(summary.teamScore).toBe(0)
    expect(summary.opponentScore).toBe(0)
    expect(summary.opponentFouls).toBe(0)
    expect(summary.teamScores.blocks).toBe(0)
    expect(summary.teamScores.eff).toBe(0)
    expect(summary.teamScores.astToRatio).toBe(0)
    expect(summary.teamScores.trueShootingPercentage).toBe(0)
    expect(summary.players).toEqual([])
    expect(summary.rebonds.teamTotal).toBe(0)
    expect(summary.rebonds.opponentTotal).toBe(0)
  })

  it('keeps team aggregates at 0 when the match contains only opponent actions', () => {
    const match = makeMatch({
      teamId: 'team-1',
      stats: [
        makeStatEntry('2pts', { type: 'success', value: 2, playerId: TEAM_OPPONENT_ID }),
        makeStatEntry('3pts', { type: 'success', value: 3, playerId: TEAM_OPPONENT_ID }),
        makeStatEntry('foul', { type: 'error', value: 1, playerId: TEAM_OPPONENT_ID }),
        makeStatEntry('offensive-rebond', { type: 'success', value: 1, playerId: TEAM_OPPONENT_ID }),
      ],
    })

    const summary = getStatSummary(match)

    expect(summary.teamScore).toBe(0)
    expect(summary.teamScores.scores.total).toBe(0)
    expect(summary.teamScores.assists).toBe(0)
    expect(summary.teamScores.blocks).toBe(0)
    expect(summary.teamScores.fouls).toBe(0)
    expect(summary.teamScores.turnover).toBe(0)
    expect(summary.teamScores.steals).toBe(0)
    expect(summary.rebonds.teamTotal).toBe(0)
    expect(summary.rebonds.teamOffensive).toBe(0)
    expect(summary.rebonds.teamDefensive).toBe(0)
    expect(summary.opponentScore).toBe(5)
    expect(summary.opponentFouls).toBe(1)
    expect(summary.rebonds.opponentTotal).toBe(1)
  })
})

describe('getFullStats', () => {
  it('returns a zeroed summary with no NaN when there are no matches', () => {
    mockOrchestrator.Matchs.matchs = []
    mockOrchestrator.Teams.teams = []

    const summary = getFullStats()

    expect(summary.teamScore).toBe(0)
    expect(summary.opponentScore).toBe(0)
    expect(summary.opponentFouls).toBe(0)
    expect(summary.teamScores.blocks).toBe(0)
    expect(summary.teamScores.eff).toBe(0)
    expect(summary.teamScores.astToRatio).toBe(0)
    expect(summary.teamScores.trueShootingPercentage).toBe(0)
    expect(summary.players).toEqual([])
    expect(summary.rebonds.teamTotal).toBe(0)
    expect(summary.rebonds.opponentTotal).toBe(0)
  })

  it('keeps player fouls at 0 when the player has no fouls across matches', () => {
    const playerId = 'player-no-fouls'
    const team = makeTeam({ id: 'team-1', name: 'Team', playerIds: [playerId] })
    const match = makeMatch({
      teamId: 'team-1',
      stats: [
        makeStatEntry('2pts', { type: 'success', value: 2, playerId }),
        makeStatEntry('assist', { type: 'success', value: 1, playerId }),
      ],
    })

    mockOrchestrator.Matchs.matchs = [match]
    mockOrchestrator.Teams.teams = [team]

    const summary = getFullStats()

    expect(summary.players).toHaveLength(1)
    expect(summary.players[0].playerId).toBe(playerId)
    expect(summary.players[0].fouls).toBe(0)
  })
})

describe('computeDerivedStats', () => {
  // Helper: minimal StatMatchSummaryPlayer for the function
  const makePlayer = (overrides: Partial<StatMatchSummaryPlayer> = {}): StatMatchSummaryPlayer => ({
    playerId: '',
    nbPlayedMatch: 1,
    playTime: null,
    scores: { '2pts': 0, '3pts': 0, 'free-throw': 0, total: 0 },
    rebonds: { offensive: 0, defensive: 0, total: 0 },
    ratio: {
      '2pts': { success: 0, fail: 0, total: 0, percentage: 0 },
      '3pts': { success: 0, fail: 0, total: 0, percentage: 0 },
      'free-throw': { success: 0, fail: 0, total: 0, percentage: 0 },
    },
    fouls: 0,
    assists: 0,
    steals: 0,
    turnover: 0,
    blocks: 0,
    eff: 0,
    astToRatio: 0,
    trueShootingPercentage: 0,
    ...overrides,
  })

  it('EFF: computes correctly for a known stat line', () => {
    // 10 pts, 5 reb, 3 ast, 2 stl, 1 blk, 4 missed FG, 1 missed FT, 2 TO
    // EFF = 10 + 5 + 3 + 2 + 1 - 4 - 1 - 2 = 14
    const player = makePlayer({
      scores: { '2pts': 0, '3pts': 0, 'free-throw': 0, total: 10 },
      rebonds: { offensive: 2, defensive: 3, total: 5 },
      assists: 3,
      steals: 2,
      blocks: 1,
      turnover: 2,
      ratio: {
        '2pts': { success: 0, fail: 3, total: 3, percentage: 0 },
        '3pts': { success: 0, fail: 1, total: 1, percentage: 0 },
        'free-throw': { success: 0, fail: 1, total: 1, percentage: 0 },
      },
    })
    const result = computeDerivedStats(player)
    expect(result.eff).toBe(14)
  })

  it('EFF: returns 0 for all-zero player', () => {
    const result = computeDerivedStats(makePlayer())
    expect(result.eff).toBe(0)
  })

  it('TS%: computes correctly for a known line', () => {
    // 20 pts on 8 FGA and 4 FTA
    // TS% = 20 / (2 * (8 + 0.44*4)) * 100 = 20 / (2 * 9.76) * 100 = 20/19.52*100 ≈ 102
    const player = makePlayer({
      scores: { '2pts': 0, '3pts': 0, 'free-throw': 0, total: 20 },
      ratio: {
        '2pts': { success: 0, fail: 4, total: 4, percentage: 0 },
        '3pts': { success: 0, fail: 4, total: 4, percentage: 0 },
        'free-throw': { success: 0, fail: 4, total: 4, percentage: 0 },
      },
    })
    const result = computeDerivedStats(player)
    // safePercentage(20, 2*(8+0.44*4)) = safePercentage(20, 19.52) = Math.round(20/19.52*100) = Math.round(102.45...) = 102
    expect(result.trueShootingPercentage).toBe(102)
  })

  it('TS%: returns 0 when FGA and FTA are both 0', () => {
    const result = computeDerivedStats(makePlayer())
    expect(result.trueShootingPercentage).toBe(0)
  })

  it('AST/TO: returns assists when turnover is 0', () => {
    const player = makePlayer({ assists: 5, turnover: 0 })
    const result = computeDerivedStats(player)
    expect(result.astToRatio).toBe(5)
  })

  it('AST/TO: computes ratio to 1 decimal when turnover > 0', () => {
    // 7 assists / 3 turnovers = 2.333... → 2.3
    const player = makePlayer({ assists: 7, turnover: 3 })
    const result = computeDerivedStats(player)
    expect(result.astToRatio).toBe(2.3)
  })
})
