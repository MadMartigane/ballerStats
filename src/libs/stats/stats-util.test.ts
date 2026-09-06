import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchRawData } from '../match/match.d'
import { makeMatch } from '../mock/factories/match.factory'
import { makeStatEntry } from '../mock/factories/stat-entry.factory'
import { makeTeam } from '../mock/factories/team.factory'
import { TEAM_OPPONENT_ID } from '../team/team'
import type { TeamRawData } from '../team/team.d'
import type { StatMatchSummaryPlayer } from './stats.d'
import {
  computeDerivedStats,
  getFullStats,
  getStatSummary,
  safeDivide,
  safePercentage,
  TEAM_PER_GAME_ID,
  TEAM_TOTAL_ID,
} from './stats-util'

const { mockMatchsStore, mockTeamsStore } = vi.hoisted(() => ({
  mockMatchsStore: {
    raws: [] as MatchRawData[],
  },
  mockTeamsStore: {
    raws: [] as TeamRawData[],
  },
}))

vi.mock('../stores/matchs-store', () => ({
  getRawMatchs: () => mockMatchsStore.raws,
}))

vi.mock('../stores/teams-store', () => ({
  getRawTeams: () => mockTeamsStore.raws,
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
      stats: [
        makeStatEntry('2pts', { playerId: TEAM_OPPONENT_ID, type: 'success', value: 2 }),
        makeStatEntry('3pts', { playerId: TEAM_OPPONENT_ID, type: 'success', value: 3 }),
        makeStatEntry('foul', { playerId: TEAM_OPPONENT_ID, type: 'error', value: 1 }),
        makeStatEntry('offensive-rebond', { playerId: TEAM_OPPONENT_ID, type: 'success', value: 1 }),
      ],
      teamId: 'team-1',
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
    mockMatchsStore.raws = []
    mockTeamsStore.raws = []

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
      stats: [
        makeStatEntry('2pts', { playerId, type: 'success', value: 2 }),
        makeStatEntry('assist', { playerId, type: 'success', value: 1 }),
      ],
      teamId: 'team-1',
    })

    mockMatchsStore.raws = [match]
    mockTeamsStore.raws = [team.getRawData()]

    const summary = getFullStats()

    expect(summary.players).toHaveLength(1)
    expect(summary.players[0].playerId).toBe(playerId)
    expect(summary.players[0].fouls).toBe(0)
  })
})

describe('getFullStats championship filter', () => {
  const playerId = 'filter-player'
  const team = makeTeam({ id: 'team-filter', name: 'FilterTeam', playerIds: [playerId] })

  const makeChampionshipMatch = (championship: string) =>
    makeMatch({
      championship,
      stats: [makeStatEntry('2pts', { playerId, type: 'success', value: 2 })],
      teamId: 'team-filter',
    })

  beforeEach(() => {
    mockTeamsStore.raws = [team.getRawData()]
  })

  it('includes all matches when called without a filter', () => {
    mockMatchsStore.raws = [makeChampionshipMatch('Saison régulière'), makeChampionshipMatch('Coupe Hiver')]

    const summary = getFullStats()

    expect(summary.players).toHaveLength(1)
    expect(summary.players[0].playerId).toBe(playerId)
    expect(summary.players[0].nbPlayedMatch).toBe(2)
  })

  it('only includes matches matching the specified championship filter', () => {
    mockMatchsStore.raws = [
      makeChampionshipMatch('Saison régulière'),
      makeChampionshipMatch('Coupe Hiver'),
      makeChampionshipMatch('Saison régulière'),
    ]

    const summary = getFullStats('Saison régulière')

    expect(summary.players[0].nbPlayedMatch).toBe(2)
  })

  it('includes all matches when the filter is an empty string', () => {
    mockMatchsStore.raws = [makeChampionshipMatch('Saison régulière'), makeChampionshipMatch('Coupe Hiver')]

    const summary = getFullStats('')

    expect(summary.players[0].nbPlayedMatch).toBe(2)
  })
})

describe('getFullStats - teamScoresTotal (cumulative vs per-game)', () => {
  // Fixture: 2 matchs, 1 player ('p1').
  // Hand-calculated expected values:
  //   Match A — 5×2pts(success, value=2), 2×assist, 1×turnover, 4×foul
  //     per-player: 10 pts, 2 ast, 1 to, 4 fouls; eff=11; astToRatio=2.0; TS%=100
  //   Match B — 3×2pts(success, value=2), 1×assist, 2×turnover, 2×foul
  //     per-player:  6 pts, 1 ast, 2 to, 2 fouls; eff=5;  astToRatio=0.5; TS%=100
  //   CUMULATIVE TOTALS (teamScoresTotal):
  //     scores.total=16, fouls=6, assists=3, turnover=3
  //     ratio['2pts']: success=8, fail=0, total=8, percentage=100
  //     eff = 16+0+3+0+0-0-0-3 = 16
  //     astToRatio = round(3/3*10)/10 = 1.0
  //     TS% = safePercentage(16, 2*(8+0)) = 100
  //   PER-GAME (teamScores, divided by 2):
  //     scores.total=8, fouls=3, assists=2, turnover=2
  //     ratio['2pts']: success=4, fail=0, total=4, percentage=100
  //     eff = 8+0+2+0+0-0-0-2 = 8
  //     astToRatio = round(2/2*10)/10 = 1.0
  //     TS% = safePercentage(8, 2*(4+0)) = 100
  // Note: the contract that getStatSummary() never populates teamScoresTotal is now
  // enforced at the type level (StatMatchSummary has no teamScoresTotal field).
  const playerId = 'p1'
  const team = makeTeam({ id: 'team-1', name: 'Team', playerIds: [playerId] })

  const matchA = makeMatch({
    stats: [
      makeStatEntry('2pts', { playerId, type: 'success', value: 2 }),
      makeStatEntry('2pts', { playerId, type: 'success', value: 2 }),
      makeStatEntry('2pts', { playerId, type: 'success', value: 2 }),
      makeStatEntry('2pts', { playerId, type: 'success', value: 2 }),
      makeStatEntry('2pts', { playerId, type: 'success', value: 2 }),
      makeStatEntry('assist', { playerId }),
      makeStatEntry('assist', { playerId }),
      makeStatEntry('turnover', { playerId, type: 'error' }),
      makeStatEntry('foul', { playerId, type: 'error' }),
      makeStatEntry('foul', { playerId, type: 'error' }),
      makeStatEntry('foul', { playerId, type: 'error' }),
      makeStatEntry('foul', { playerId, type: 'error' }),
    ],
    teamId: 'team-1',
  })

  const matchB = makeMatch({
    stats: [
      makeStatEntry('2pts', { playerId, type: 'success', value: 2 }),
      makeStatEntry('2pts', { playerId, type: 'success', value: 2 }),
      makeStatEntry('2pts', { playerId, type: 'success', value: 2 }),
      makeStatEntry('assist', { playerId }),
      makeStatEntry('turnover', { playerId, type: 'error' }),
      makeStatEntry('turnover', { playerId, type: 'error' }),
      makeStatEntry('foul', { playerId, type: 'error' }),
      makeStatEntry('foul', { playerId, type: 'error' }),
    ],
    teamId: 'team-1',
  })

  // Shared setup: register the two-match fixture so each `it` only carries its
  // unique assertions. The empty-matchs case below overrides the orchestrator
  // state explicitly to assert the zeroed-totals branch.
  beforeEach(() => {
    mockMatchsStore.raws = [matchA, matchB]
    mockTeamsStore.raws = [team.getRawData()]
  })

  it('populates teamScoresTotal and uses the exported sentinel playerId constants', () => {
    const summary = getFullStats()

    expect(summary.teamScoresTotal).toBeDefined()
    expect(summary.teamScores.playerId).toBe(TEAM_PER_GAME_ID)
    expect(summary.teamScoresTotal.playerId).toBe(TEAM_TOTAL_ID)
  })

  it('per-game row divides volume stats by nbMatch (scores.total, fouls)', () => {
    const summary = getFullStats()

    // raw totals: scores.total=16, fouls=6 → /2 → 8 and 3
    expect(summary.teamScores.scores.total).toBe(8)
    expect(summary.teamScores.fouls).toBe(3)
  })

  it('totals row keeps raw cumulative sums (scores.total, fouls, assists)', () => {
    const summary = getFullStats()

    expect(summary.teamScoresTotal.scores.total).toBe(16)
    expect(summary.teamScoresTotal.fouls).toBe(6)
    expect(summary.teamScoresTotal.assists).toBe(3)
  })

  it('percentages are identical on both rows (copied from totals row by restoreInvariantRates)', () => {
    const summary = getFullStats()

    // RFC invariant: rate stats are copied from the totals row (computed from
    // raw totals); identical on both rows by construction. The fixture only has
    // successful 2pts attempts → 100% on both rows.
    const expectedPercentage = 100
    expect(summary.teamScores.ratio['2pts'].percentage).toBe(expectedPercentage)
    expect(summary.teamScoresTotal.ratio['2pts'].percentage).toBe(expectedPercentage)
    expect(summary.teamScores.ratio['2pts'].percentage).toBe(summary.teamScoresTotal.ratio['2pts'].percentage)
  })

  it('restores invariant rate stats (FT%, AST/TO) on per-game row from totals row when rounding diverges', () => {
    // Divergent-rounding fixture: 2 matchs, 1 player. Designed so per-game
    // rounding (Math.round inside safeDivide) makes the per-game rate stats
    // differ from the totals-row rate stats, which would FAIL without the
    // restoreInvariantRates step in getFullStats().
    //   Match A: 1 free-throw success, 1 free-throw fail, 1 assist, 2 turnovers
    //   Match B: 1 free-throw fail,                       1 turnover
    //   Raw totals (teamScoresTotal):
    //     ft: success=1, fail=2, total=3
    //       → FT% = safePercentage(1, 3) = Math.round(33.33) = 33
    //     assists=1, turnover=3
    //       → AST/TO = Math.round((1/3) * 10) / 10 = 3/10 = 0.3
    //   Per-game volumes (safeDivide over nbMatch=2):
    //     ft success = safeDivide(1, 2) = Math.round(0.5) = 1
    //     ft fail    = safeDivide(2, 2) = 1
    //     ft total   = safeDivide(3, 2) = Math.round(1.5) = 2
    //       → FT% (pre-restore) = safePercentage(1, 2) = 50  ← would differ
    //     assists   = safeDivide(1, 2) = 1
    //     turnover  = safeDivide(3, 2) = 2
    //       → AST/TO (pre-restore) = Math.round((1/2) * 10) / 10 = 5/10 = 0.5  ← would differ
    //   Per-game (post-restoreInvariantRates): FT% = 33, AST/TO = 0.3 (match totals)
    const divergentPlayerId = 'p-div'
    const teamDiv = makeTeam({ id: 'team-div', name: 'TeamDiv', playerIds: [divergentPlayerId] })

    const divergentMatchA = makeMatch({
      stats: [
        makeStatEntry('free-throw', { playerId: divergentPlayerId, type: 'success' }),
        makeStatEntry('free-throw', { playerId: divergentPlayerId, type: 'error' }),
        makeStatEntry('assist', { playerId: divergentPlayerId }),
        makeStatEntry('turnover', { playerId: divergentPlayerId, type: 'error' }),
        makeStatEntry('turnover', { playerId: divergentPlayerId, type: 'error' }),
      ],
      teamId: 'team-div',
    })

    const divergentMatchB = makeMatch({
      stats: [
        makeStatEntry('free-throw', { playerId: divergentPlayerId, type: 'error' }),
        makeStatEntry('turnover', { playerId: divergentPlayerId, type: 'error' }),
      ],
      teamId: 'team-div',
    })

    // Override shared fixture: this case registers its own divergent-rounding orchestrator state.
    mockMatchsStore.raws = [divergentMatchA, divergentMatchB]
    mockTeamsStore.raws = [teamDiv.getRawData()]

    const summary = getFullStats()

    // Free-throw percentage is restored from totals (33 on both rows).
    expect(summary.teamScoresTotal.ratio['free-throw'].percentage).toBe(33)
    expect(summary.teamScores.ratio['free-throw'].percentage).toBe(33)
    expect(summary.teamScores.ratio['free-throw'].percentage).toBe(
      summary.teamScoresTotal.ratio['free-throw'].percentage
    )

    // AST/TO is restored from totals (0.3 on both rows).
    expect(summary.teamScoresTotal.astToRatio).toBe(0.3)
    expect(summary.teamScores.astToRatio).toBe(0.3)
    expect(summary.teamScores.astToRatio).toBe(summary.teamScoresTotal.astToRatio)
  })

  it('EFF on totals row is strictly greater than EFF on per-game row (nbMatch > 1)', () => {
    const summary = getFullStats()

    expect(summary.teamScoresTotal.eff).toBe(16)
    expect(summary.teamScores.eff).toBe(8)
    expect(summary.teamScoresTotal.eff).toBeGreaterThan(summary.teamScores.eff)
  })

  it('AST/TO identical on both rows and equal to hand-calculated value (1.0)', () => {
    const summary = getFullStats()

    expect(summary.teamScores.astToRatio).toBe(1.0)
    expect(summary.teamScoresTotal.astToRatio).toBe(1.0)
    expect(summary.teamScores.astToRatio).toBe(summary.teamScoresTotal.astToRatio)
  })

  it('TS% identical on both rows', () => {
    const summary = getFullStats()

    expect(summary.teamScores.trueShootingPercentage).toBe(100)
    expect(summary.teamScoresTotal.trueShootingPercentage).toBe(100)
    expect(summary.teamScores.trueShootingPercentage).toBe(summary.teamScoresTotal.trueShootingPercentage)
  })

  it('uniform division: teamScores.fouls === Math.round(teamScoresTotal.fouls / nbMatch)', () => {
    const summary = getFullStats()
    const nbMatch = 2

    expect(summary.teamScores.fouls).toBe(Math.round(summary.teamScoresTotal.fouls / nbMatch))
  })

  it('empty matchs array → teamScoresTotal is defined-but-zeroed and teamScores.scores.total === 0', () => {
    // Override the shared fixture: this case sets its own orchestrator state.
    mockMatchsStore.raws = []
    mockTeamsStore.raws = []

    const summary = getFullStats()

    expect(summary.teamScoresTotal).toBeDefined()
    expect(summary.teamScoresTotal.scores.total).toBe(0)
    expect(summary.teamScoresTotal.playerId).toBe(TEAM_TOTAL_ID)
    expect(summary.teamScores.scores.total).toBe(0)
    expect(summary.teamScores.playerId).toBe(TEAM_PER_GAME_ID)
  })

  it('rebonds override: per-game total is divided directly, so it diverges from off+def by ±1 when rounding', () => {
    // Fixture: 2 matchs, 1 player. Rebonds distributed so safeDivide rounding
    // forces a visible ±1 divergence between rebonds.total and offensive + defensive.
    //   Match A: 2 offensive-rebond + 1 defensive-rebond
    //   Match B: 1 offensive-rebond + 2 defensive-rebond
    //   Raw totals: offensive=3, defensive=3, total=6
    //   Per-game:  offensive = safeDivide(3, 2) = 2
    //              defensive = safeDivide(3, 2) = 2
    //              total (override) = safeDivide(6, 2) = 3
    //   so total(3) !== off(2) + def(2) (= 4)  ← pins divideTeamScoresBy's rebonds override
    //   and total(3) === safeDivide(teamScoresTotal.total, nbMatch)             ← pins the override semantics
    const reboundsPlayerId = 'p1'
    const teamReb = makeTeam({ id: 'team-reb', name: 'TeamReb', playerIds: [reboundsPlayerId] })

    const reboundsMatchA = makeMatch({
      stats: [
        makeStatEntry('offensive-rebond', { playerId: reboundsPlayerId, type: 'success', value: 1 }),
        makeStatEntry('offensive-rebond', { playerId: reboundsPlayerId, type: 'success', value: 1 }),
        makeStatEntry('defensive-rebond', { playerId: reboundsPlayerId, type: 'secondary', value: 1 }),
      ],
      teamId: 'team-reb',
    })

    const reboundsMatchB = makeMatch({
      stats: [
        makeStatEntry('offensive-rebond', { playerId: reboundsPlayerId, type: 'success', value: 1 }),
        makeStatEntry('defensive-rebond', { playerId: reboundsPlayerId, type: 'secondary', value: 1 }),
        makeStatEntry('defensive-rebond', { playerId: reboundsPlayerId, type: 'secondary', value: 1 }),
      ],
      teamId: 'team-reb',
    })

    // Override shared fixture: this case registers its own rebond-heavy orchestrator state.
    mockMatchsStore.raws = [reboundsMatchA, reboundsMatchB]
    mockTeamsStore.raws = [teamReb.getRawData()]

    const summary = getFullStats()
    const nbMatch = 2

    // The override is active: per-game total equals safeDivide(rawTotal, nbMatch).
    expect(summary.teamScores.rebonds.total).toBe(safeDivide(summary.teamScoresTotal.rebonds.total, nbMatch))
    // The override causes a visible ±1 divergence: 3 !== 2 + 2.
    expect(summary.teamScores.rebonds.total).not.toBe(
      summary.teamScores.rebonds.offensive + summary.teamScores.rebonds.defensive
    )
    // Pin the concrete values for clarity (3 vs 2+2=4).
    expect(summary.teamScores.rebonds.total).toBe(3)
    expect(summary.teamScores.rebonds.offensive).toBe(2)
    expect(summary.teamScores.rebonds.defensive).toBe(2)
  })
})

describe('computeDerivedStats', () => {
  // Helper: minimal StatMatchSummaryPlayer for the function
  const makePlayer = (overrides: Partial<StatMatchSummaryPlayer> = {}): StatMatchSummaryPlayer => ({
    assists: 0,
    astToRatio: 0,
    blocks: 0,
    eff: 0,
    fouls: 0,
    nbPlayedMatch: 1,
    playerId: '',
    playTime: null,
    ratio: {
      '2pts': { fail: 0, percentage: 0, success: 0, total: 0 },
      '3pts': { fail: 0, percentage: 0, success: 0, total: 0 },
      'free-throw': { fail: 0, percentage: 0, success: 0, total: 0 },
    },
    rebonds: { defensive: 0, offensive: 0, total: 0 },
    scores: { '2pts': 0, '3pts': 0, 'free-throw': 0, total: 0 },
    steals: 0,
    trueShootingPercentage: 0,
    turnover: 0,
    ...overrides,
  })

  it('EFF: computes correctly for a known stat line', () => {
    // 10 pts, 5 reb, 3 ast, 2 stl, 1 blk, 4 missed FG, 1 missed FT, 2 TO
    // EFF = 10 + 5 + 3 + 2 + 1 - 4 - 1 - 2 = 14
    const player = makePlayer({
      assists: 3,
      blocks: 1,
      ratio: {
        '2pts': { fail: 3, percentage: 0, success: 0, total: 3 },
        '3pts': { fail: 1, percentage: 0, success: 0, total: 1 },
        'free-throw': { fail: 1, percentage: 0, success: 0, total: 1 },
      },
      rebonds: { defensive: 3, offensive: 2, total: 5 },
      scores: { '2pts': 0, '3pts': 0, 'free-throw': 0, total: 10 },
      steals: 2,
      turnover: 2,
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
      ratio: {
        '2pts': { fail: 4, percentage: 0, success: 0, total: 4 },
        '3pts': { fail: 4, percentage: 0, success: 0, total: 4 },
        'free-throw': { fail: 4, percentage: 0, success: 0, total: 4 },
      },
      scores: { '2pts': 0, '3pts': 0, 'free-throw': 0, total: 20 },
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
