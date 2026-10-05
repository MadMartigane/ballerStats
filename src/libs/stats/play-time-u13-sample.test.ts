import { describe, expect, it } from 'vitest'
import { U13_SAMPLE_MATCH } from '../mock/fixtures/u13-sample-match'
import { getTheoreticalPlayerMinutes, type MatchFormatConfig } from '../team/match-format'
import { computePlayTimes, computePlayTimeWeight } from './play-time'

/**
 * Standalone characterisation of the play-time engine over the sample U13 fixture.
 *
 * This suite runs from the fixture alone (no scenario, no store) and pins the
 * hard-coded regression anchors so a silent drift of the engine, of the fixture,
 * or of the dead-ball handling is caught immediately.
 *
 * The fixture now carries its official match sheet, so the engine blends both
 * sources and renormalises the blend onto the theoretical total; the anchors below
 * are the blended raw values and their renormalised finals.
 */

/** U13 4x8 format: 4 x 8 x 5 -> 32-minute ceiling, 160 theoretical minutes. */
const U13_4X8_FORMAT: MatchFormatConfig = { periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 }
const CEILING_MINUTES = 32
const THEORETICAL_MINUTES = getTheoreticalPlayerMinutes(U13_4X8_FORMAT)

/** `toBeCloseTo` precision 2 => |delta| < 0.005, inside the required +/- 0.01 window. */
const ANCHOR_PRECISION = 2

const EXPECTED_SUBSTITUTION_EVENTS = 49
const EXPECTED_GAME_STOP_EVENTS = 84
const EXPECTED_TOTAL_EVENTS = 407

interface EngineAnchor {
  finalMinutes: number
  jerseyNumber: string
  rawMinutes: number
}

/**
 * Hard-coded anchors keyed by jersey number: the blended source minutes and the
 * renormalised final minutes the engine must return.
 */
const ENGINE_ANCHORS: readonly EngineAnchor[] = [
  { finalMinutes: 29.2581, jerseyNumber: '13', rawMinutes: 28.8958 },
  { finalMinutes: 24.3735, jerseyNumber: '9', rawMinutes: 24.0716 },
  { finalMinutes: 22.5416, jerseyNumber: '7', rawMinutes: 22.2624 },
  { finalMinutes: 19.3014, jerseyNumber: '4', rawMinutes: 19.0624 },
  { finalMinutes: 17.6585, jerseyNumber: '5', rawMinutes: 17.4398 },
  { finalMinutes: 17.6244, jerseyNumber: '12', rawMinutes: 17.4061 },
  { finalMinutes: 15.4001, jerseyNumber: '8', rawMinutes: 15.2093 },
  { finalMinutes: 13.8425, jerseyNumber: '10', rawMinutes: 13.6711 },
]

const PLAYER_ID_BY_JERSEY = new Map(U13_SAMPLE_MATCH.players.map((player) => [player.jerseyNumber, player.id]))

function runEngine() {
  return computePlayTimes(
    { stats: [...U13_SAMPLE_MATCH.stats], tablePlayTimes: U13_SAMPLE_MATCH.tablePlayTimes },
    U13_4X8_FORMAT
  )
}

function runEventsOnly() {
  return computePlayTimes({ stats: [...U13_SAMPLE_MATCH.stats] }, U13_4X8_FORMAT)
}

function entryByJersey(result: ReturnType<typeof runEngine>, jerseyNumber: string) {
  const playerId = PLAYER_ID_BY_JERSEY.get(jerseyNumber)
  return result.entries.find((entry) => entry.playerId === playerId)
}

describe('U13 sample fixture shape', () => {
  it('carries 49 substitution events, 84 game-stop events and 407 events in total', () => {
    const substitutionCount = U13_SAMPLE_MATCH.stats.filter(
      (entry) => entry.name === 'fiveIn' || entry.name === 'fiveOut'
    ).length
    const gameStopCount = U13_SAMPLE_MATCH.stats.filter((entry) => entry.name === 'gameStop').length

    expect(substitutionCount).toBe(EXPECTED_SUBSTITUTION_EVENTS)
    expect(gameStopCount).toBe(EXPECTED_GAME_STOP_EVENTS)
    expect(U13_SAMPLE_MATCH.stats).toHaveLength(EXPECTED_TOTAL_EVENTS)
  })
})

describe('computePlayTimes over the U13 sample fixture', () => {
  it('measures the whole fixture: source totals, quality, weight and renormalisation anchors', () => {
    const result = runEngine()

    expect(result.quality.events.totalMinutes).toBeCloseTo(163.4897, ANCHOR_PRECISION)
    expect(result.quality.events.percentage).toBe(1)
    expect(result.quality.table.totalMinutes).toBe(152)
    expect(result.quality.table.percentage).toBeCloseTo(0.909_090_9, 5)
    expect(computePlayTimeWeight(result.quality)).toBeCloseTo(0.476_190_5, 5)
    expect(result.deviationRatio).toBeCloseTo(0.021_811, 5)
    expect(result.renormalised).toBe(true)

    // Uniform rescale of the blended raw total (158.0184) onto the 160-minute target.
    const factor = (result.entries[0]?.minutes ?? 0) / (result.entries[0]?.rawMinutes ?? 1)
    expect(factor).toBeCloseTo(1.0125, 3)
  })

  it('produces one entry per fixture player with the exact per-jersey anchors', () => {
    const result = runEngine()

    expect(result.entries).toHaveLength(U13_SAMPLE_MATCH.players.length)

    for (const anchor of ENGINE_ANCHORS) {
      const entry = entryByJersey(result, anchor.jerseyNumber)
      expect(entry, `missing entry for jersey ${anchor.jerseyNumber}`).toBeDefined()
      expect(entry?.rawMinutes).toBeCloseTo(anchor.rawMinutes, ANCHOR_PRECISION)
      expect(entry?.minutes).toBeCloseTo(anchor.finalMinutes, ANCHOR_PRECISION)
    }
  })

  it('totals the final minutes to the theoretical total and keeps every value under the 32-minute ceiling', () => {
    const result = runEngine()
    const totalFinalMinutes = result.entries.reduce((sum, entry) => sum + entry.minutes, 0)

    // Systematic renormalisation scales the blended raw total onto the theoretical total.
    expect(totalFinalMinutes).toBeCloseTo(THEORETICAL_MINUTES, ANCHOR_PRECISION)
    for (const entry of result.entries) {
      expect(entry.minutes).toBeLessThanOrEqual(CEILING_MINUTES)
    }
  })

  it('renormalises systematically: every final value equals its raw value times the same factor', () => {
    const result = runEngine()
    const factor = (result.entries[0]?.minutes ?? 0) / (result.entries[0]?.rawMinutes ?? 1)

    for (const entry of result.entries) {
      expect(entry.minutes).toBeCloseTo(entry.rawMinutes * factor, ANCHOR_PRECISION)
      expect(entry.minutes).toBeLessThanOrEqual(CEILING_MINUTES)
    }
  })

  it('preserves the raw ranking in the final values', () => {
    const result = runEngine()
    const byRaw = [...result.entries].sort((left, right) => right.rawMinutes - left.rawMinutes).map((e) => e.playerId)
    const byFinal = [...result.entries].sort((left, right) => right.minutes - left.minutes).map((e) => e.playerId)

    expect(byFinal).toEqual(byRaw)
  })

  it('reports a null table quality when no match sheet is passed', () => {
    const result = runEventsOnly()

    expect(result.quality.table.totalMinutes).toBe(0)
    expect(result.quality.table.gap).toBeNull()
    expect(result.quality.table.percentage).toBeNull()
  })

  it('agrees with the fixture own expected fields (anti-drift check)', () => {
    const result = runEngine()
    const entriesByPlayerId = new Map(result.entries.map((entry) => [entry.playerId, entry]))

    for (const player of U13_SAMPLE_MATCH.players) {
      const entry = entriesByPlayerId.get(player.id)
      expect(entry, `missing entry for player ${player.id}`).toBeDefined()
      expect(entry?.rawMinutes).toBeCloseTo(player.expectedRawMinutes, ANCHOR_PRECISION)
      expect(entry?.minutes).toBeCloseTo(player.expectedPlayTime, ANCHOR_PRECISION)
    }
  })
})
