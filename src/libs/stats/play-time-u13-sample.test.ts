import { describe, expect, it } from 'vitest'
import { U13_SAMPLE_MATCH } from '../mock/fixtures/u13-sample-match'
import type { MatchFormatConfig } from '../team/match-format'
import { computePlayTimes } from './play-time'

/**
 * Standalone characterisation of the play-time engine over the sample U13 fixture.
 *
 * This suite runs from the fixture alone (no scenario, no store) and pins the
 * hard-coded regression anchors so a silent drift of the engine, of the fixture,
 * or of the dead-ball handling is caught immediately.
 */

/** U13 4x8 format: 4 x 8 x 5 -> 32-minute ceiling, 160 theoretical minutes. */
const U13_4X8_FORMAT: MatchFormatConfig = { periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 }
const CEILING_MINUTES = 32

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
 * Hard-coded anchors keyed by jersey number: the un-renormalised interval union
 * and the final minutes the engine must return.
 */
const ENGINE_ANCHORS: readonly EngineAnchor[] = [
  { finalMinutes: 29.71, jerseyNumber: '13', rawMinutes: 29.71 },
  { finalMinutes: 25.95, jerseyNumber: '9', rawMinutes: 25.95 },
  { finalMinutes: 22.5, jerseyNumber: '7', rawMinutes: 22.5 },
  { finalMinutes: 19.12, jerseyNumber: '4', rawMinutes: 19.12 },
  { finalMinutes: 16.93, jerseyNumber: '5', rawMinutes: 16.93 },
  { finalMinutes: 16.87, jerseyNumber: '12', rawMinutes: 16.87 },
  { finalMinutes: 16.31, jerseyNumber: '8', rawMinutes: 16.31 },
  { finalMinutes: 16.1, jerseyNumber: '10', rawMinutes: 16.1 },
]

const PLAYER_ID_BY_JERSEY = new Map(U13_SAMPLE_MATCH.players.map((player) => [player.jerseyNumber, player.id]))

function runEngine() {
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
  it('measures the whole fixture: totals and deviation anchors', () => {
    const result = runEngine()

    expect(result.quality.eventsTotalMinutes).toBeCloseTo(163.4897, ANCHOR_PRECISION)
    expect(result.deviationRatio).toBeCloseTo(0.021_811, 5)
    expect(result.renormalised).toBe(false)
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

  it('totals the final minutes to the raw total and keeps every value under the 32-minute ceiling', () => {
    const result = runEngine()
    const totalFinalMinutes = result.entries.reduce((sum, entry) => sum + entry.minutes, 0)

    // The deviation stays inside the tolerance, so nothing is rescaled: the final
    // minutes are the raw interval-union minutes.
    expect(totalFinalMinutes).toBeCloseTo(163.4897, ANCHOR_PRECISION)
    for (const entry of result.entries) {
      expect(entry.minutes).toBeLessThanOrEqual(CEILING_MINUTES)
    }
  })

  it('never renormalises: every final value equals its raw value', () => {
    const result = runEngine()

    for (const entry of result.entries) {
      expect(entry.minutes).toBeCloseTo(entry.rawMinutes, ANCHOR_PRECISION)
    }
  })

  it('preserves the raw ranking in the final values', () => {
    const result = runEngine()
    const byRaw = [...result.entries].sort((left, right) => right.rawMinutes - left.rawMinutes).map((e) => e.playerId)
    const byFinal = [...result.entries].sort((left, right) => right.minutes - left.minutes).map((e) => e.playerId)

    expect(byFinal).toEqual(byRaw)
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
