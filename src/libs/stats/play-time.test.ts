import { describe, expect, it } from 'vitest'
import type { MatchStatLogEntry } from '../match/match.d'
import type { MatchFormatConfig } from '../team/match-format'
import type { PlayTimeEntry } from './play-time'
import { computePlayTimes, PLAY_TIME_TOLERANCE } from './play-time'

/** Generic 4 x 7 format: ceiling 28 min, theoretical total 140 min. */
const TEST_FORMAT: MatchFormatConfig = { periodLengthMinutes: 7, periods: 4, playersOnCourt: 5 }
const CEILING = 28
const THEORETICAL = 140

const MINUTE = 60_000
const BASE_TIMESTAMP = 1_700_000_000_000

/** Disable renormalisation to inspect the raw interval union in isolation. */
const NO_RENORMALISATION = { tolerance: Number.MAX_VALUE }

function stat(name: MatchStatLogEntry['name'], playerId: string | null, atMinute: number): MatchStatLogEntry {
  return { name, playerId, timestamp: BASE_TIMESTAMP + atMinute * MINUTE, type: 'success', value: 1 }
}

function playInterval(playerId: string, fromMinute: number, toMinute: number): MatchStatLogEntry[] {
  return [stat('fiveIn', playerId, fromMinute), stat('fiveOut', playerId, toMinute)]
}

/** A `gameStop` toggle: consecutive pairs delimit dead-ball windows. */
function gameStop(atMinute: number): MatchStatLogEntry {
  return stat('gameStop', null, atMinute)
}

function entryFor(entries: PlayTimeEntry[], playerId: string): PlayTimeEntry | undefined {
  return entries.find((entry) => entry.playerId === playerId)
}

describe('computePlayTimes', () => {
  it('returns an empty result for a match without stats', () => {
    const result = computePlayTimes({ stats: [] }, TEST_FORMAT)

    expect(result.entries).toEqual([])
    expect(result.quality.eventsTotalMinutes).toBe(0)
    expect(result.quality.tableTotalMinutes).toBe(0)
    expect(result.quality.gap).toBeNull()
    expect(result.quality.percentage).toBeNull()
    expect(result.deviationRatio).toBe(0)
    expect(result.renormalised).toBe(false)
  })

  it('treats a missing stats field like an empty match', () => {
    const result = computePlayTimes({}, TEST_FORMAT)

    expect(result.entries).toEqual([])
    expect(result.quality.gap).toBeNull()
  })

  it('keeps table-recorded times for a table-only match with zero stat events', () => {
    const result = computePlayTimes({ stats: [], tablePlayTimes: { p1: 12, p2: 40 } }, TEST_FORMAT)

    expect(result.entries.map((entry) => entry.playerId)).toEqual(['p1', 'p2'])
    expect(entryFor(result.entries, 'p1')?.minutes).toBe(12)
    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(12)
    expect(entryFor(result.entries, 'p1')?.source).toBe('table')
    // 40 is clamped to the 28-minute ceiling; the source stays the table.
    expect(entryFor(result.entries, 'p2')?.minutes).toBe(CEILING)
    expect(result.quality.eventsTotalMinutes).toBe(0)
    // The quality metric reads the raw sheet sum (12 + 40), unclamped.
    expect(result.quality.tableTotalMinutes).toBe(52)
    expect(result.quality.gap).toBeNull()
    expect(result.renormalised).toBe(false)
  })

  it('sums closed intervals and closes an open interval at the last event timestamp', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 0, 5), stat('foul', null, 30), stat('fiveIn', 'p2', 10)]
    const result = computePlayTimes({ stats }, TEST_FORMAT, NO_RENORMALISATION)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(5)
    expect(entryFor(result.entries, 'p2')?.rawMinutes).toBe(20)
    expect(result.quality.eventsTotalMinutes).toBe(25)
  })

  it('uses the max timestamp over all stats, including non-substitution events, as the window end', () => {
    const stats: MatchStatLogEntry[] = [stat('fiveIn', 'p1', 0), stat('gameStop', null, 6)]
    const result = computePlayTimes({ stats }, TEST_FORMAT, NO_RENORMALISATION)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(6)
  })

  it('omits a player who has stats but no fiveIn event', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 0, 5), stat('2pts', 'p2', 3)]
    const result = computePlayTimes({ stats }, TEST_FORMAT, NO_RENORMALISATION)

    expect(result.entries.map((entry) => entry.playerId)).toEqual(['p1'])
  })

  it('ignores a fiveOut without a matching fiveIn', () => {
    const stats: MatchStatLogEntry[] = [stat('fiveOut', 'p1', 5), stat('foul', null, 10)]
    const result = computePlayTimes({ stats }, TEST_FORMAT, NO_RENORMALISATION)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(0)
    expect(result.quality.eventsTotalMinutes).toBe(0)
    expect(result.renormalised).toBe(false)
  })

  it('restarts the open interval on a double-IN, dropping the dangling earlier one', () => {
    const stats: MatchStatLogEntry[] = [stat('fiveIn', 'p1', 0), stat('fiveIn', 'p1', 3), stat('fiveOut', 'p1', 8)]
    const result = computePlayTimes({ stats }, TEST_FORMAT, NO_RENORMALISATION)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(5)
  })

  it('gives zero live minutes to an interval lying entirely inside a dead-ball window', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 3, 7), gameStop(2), gameStop(8), stat('foul', null, 8)]
    const result = computePlayTimes({ stats }, TEST_FORMAT, NO_RENORMALISATION)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(0)
  })

  it('keeps only the live part of an interval partially overlapping a dead-ball window', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 0, 10), gameStop(2), gameStop(8)]
    const result = computePlayTimes({ stats }, TEST_FORMAT, NO_RENORMALISATION)

    // [0,2] + [8,10] = 4 min live.
    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(4)
  })

  it('subtracts every dead-ball window from the interval', () => {
    const stats: MatchStatLogEntry[] = [
      ...playInterval('p1', 0, 10),
      gameStop(2),
      gameStop(4),
      gameStop(6),
      gameStop(8),
    ]
    const result = computePlayTimes({ stats }, TEST_FORMAT, NO_RENORMALISATION)

    // [0,2] + [4,6] + [8,10] = 6 min live.
    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(6)
  })

  it('ignores a trailing unpaired gameStop', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 0, 10), gameStop(2), gameStop(8), gameStop(12)]
    const result = computePlayTimes({ stats }, TEST_FORMAT, NO_RENORMALISATION)

    // The [2,8] window is live-excluded; the dangling 12 is ignored (match stopped at the whistle).
    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(4)
  })

  it('never counts the opponent sentinel as one of our players', () => {
    const stats: MatchStatLogEntry[] = [
      ...playInterval('OPPONENT', 0, 20),
      ...playInterval('p1', 0, 5),
      stat('gameStop', null, 20),
    ]
    const result = computePlayTimes({ stats }, TEST_FORMAT, NO_RENORMALISATION)

    expect(result.entries.map((entry) => entry.playerId)).toEqual(['p1'])
  })

  it('keeps raw values without dividing by zero when nothing was measured', () => {
    const stats: MatchStatLogEntry[] = [stat('fiveOut', 'p1', 5), stat('foul', null, 10)]
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(result.quality.eventsTotalMinutes).toBe(0)
    expect(result.renormalised).toBe(false)
    expect(result.deviationRatio).toBe(0)
    for (const entry of result.entries) {
      expect(Number.isFinite(entry.minutes)).toBe(true)
    }
  })

  it('keeps raw values when the deviation stays within tolerance', () => {
    // Five players on court almost the whole match: 5 x 27.6 = 138 min, deviation -1.4%.
    const stats = [
      ...playInterval('p1', 0, 27.6),
      ...playInterval('p2', 0, 27.6),
      ...playInterval('p3', 0, 27.6),
      ...playInterval('p4', 0, 27.6),
      ...playInterval('p5', 0, 27.6),
    ]
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(result.quality.eventsTotalMinutes).toBeCloseTo(138, 5)
    expect(Math.abs(result.deviationRatio)).toBeLessThanOrEqual(PLAY_TIME_TOLERANCE)
    expect(result.renormalised).toBe(false)
    expect(entryFor(result.entries, 'p1')?.minutes).toBeCloseTo(27.6, 5)
  })

  it('renormalises onto the theoretical total when the deviation exceeds tolerance', () => {
    // Eight players x 20 min = 160 min, deviation +14.3%.
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
    const stats = playerIds.flatMap((playerId) => playInterval(playerId, 0, 20))
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(result.quality.eventsTotalMinutes).toBeCloseTo(160, 5)
    expect(result.deviationRatio).toBeCloseTo(160 / 140 - 1, 5)
    expect(result.renormalised).toBe(true)

    const summed = result.entries.reduce((total, entry) => total + entry.minutes, 0)
    expect(summed).toBeCloseTo(THEORETICAL, 5)
    for (const entry of result.entries) {
      expect(entry.rawMinutes).toBeCloseTo(20, 5)
      expect(entry.minutes).toBeCloseTo(17.5, 5)
    }
  })

  it('renormalises the unclamped raw values and clamps to the ceiling last', () => {
    // Four players x 50 min = 200 min raw; factor 140/200 = 0.7 -> 35 min, clamped to 28.
    const playerIds = ['p1', 'p2', 'p3', 'p4']
    const stats = playerIds.flatMap((playerId) => playInterval(playerId, 0, 50))
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(result.renormalised).toBe(true)
    // Clamping the raw first would have produced 28 x 0.7 = 19.6 instead.
    for (const playerId of playerIds) {
      const entry = entryFor(result.entries, playerId)
      expect(entry?.rawMinutes).toBeCloseTo(50, 5)
      expect(entry?.minutes).toBe(CEILING)
    }
  })

  it('renormalises mixed table and event players onto the theoretical total', () => {
    // Five measured players x 12 min = 60 events, plus two sheet-only players at 25 and 25.
    // The sheet-only players are never rescaled, so the measured part targets
    // 140 - 50 = 90 and the factor is 90 / 60 = 1.5.
    const measuredIds = ['p1', 'p2', 'p3', 'p4', 'p5']
    const stats = measuredIds.flatMap((playerId) => playInterval(playerId, 0, 12))
    const result = computePlayTimes({ stats, tablePlayTimes: { t1: 25, t2: 25 } }, TEST_FORMAT)

    expect(result.renormalised).toBe(true)
    for (const playerId of measuredIds) {
      expect(entryFor(result.entries, playerId)?.minutes).toBeCloseTo(18, 5)
    }
    for (const playerId of ['t1', 't2']) {
      const entry = entryFor(result.entries, playerId)
      expect(entry?.source).toBe('table')
      expect(entry?.minutes).toBe(25)
    }

    const summed = result.entries.reduce((total, entry) => total + entry.minutes, 0)
    expect(summed).toBeCloseTo(THEORETICAL, 5)
  })

  it('does not rescale sheet-only players in a mixed renormalised match', () => {
    // A blended player joins the mix: sheet 30 (clamped to the 28 ceiling) + events 10
    // -> 0.6*28 + 0.4*10 = 20.8. Sheet-only t1 = 25 stays 25; the measured part
    // (20.8 + 10 = 30.8) targets 140 - 25 = 115, and the ceiling still applies last.
    const stats = [...playInterval('e1', 0, 10), ...playInterval('b1', 0, 10)]
    const result = computePlayTimes({ stats, tablePlayTimes: { b1: 30, t1: 25 } }, TEST_FORMAT)

    expect(result.renormalised).toBe(true)
    expect(entryFor(result.entries, 't1')?.minutes).toBe(25)
    expect(entryFor(result.entries, 'b1')?.rawMinutes).toBeCloseTo(20.8, 5)
    // Factor 115 / 30.8 = 3.734... -> 20.8 * factor, clamped to the 28-minute ceiling.
    expect(entryFor(result.entries, 'b1')?.minutes).toBe(CEILING)
    expect(entryFor(result.entries, 'e1')?.rawMinutes).toBeCloseTo(10, 5)
  })

  it('does not zero measured players when the sheet alone consumes the theoretical budget', () => {
    // Six sheet-only players at 27 (Σ 162 ≥ 140) plus one blended player (sheet 10,
    // events 12 -> blend 10.8) and one events-only player at 10. The sheet consumed the
    // budget, so remainingTheoreticalMinutes is 0: renormalisation must stand down and
    // both measured entries keep their own records rather than being multiplied by 0.
    const stats = [...playInterval('b1', 0, 12), ...playInterval('e1', 0, 10)]
    const tablePlayTimes: Record<string, number> = { b1: 10 }
    for (let index = 1; index <= 6; index += 1) {
      tablePlayTimes[`t${index}`] = 27
    }
    const result = computePlayTimes({ stats, tablePlayTimes }, TEST_FORMAT)

    // The deviation gate is still open (|−0.914| > 10 %), but the budget guard stands it down.
    expect(Math.abs(result.deviationRatio)).toBeGreaterThan(PLAY_TIME_TOLERANCE)
    expect(result.renormalised).toBe(false)

    const blended = entryFor(result.entries, 'b1')
    expect(blended?.rawMinutes).toBeCloseTo(10.8, 5)
    expect(blended?.minutes).toBeCloseTo(10.8, 5)
    expect(blended?.minutes).toBeGreaterThan(0)

    const computed = entryFor(result.entries, 'e1')
    expect(computed?.minutes).toBeCloseTo(10, 5)
    expect(computed?.minutes).toBeGreaterThan(0)

    for (const index of [1, 2, 3, 4, 5, 6]) {
      expect(entryFor(result.entries, `t${index}`)?.minutes).toBe(27)
    }
  })

  it('blends the table and event minutes at 60/40 when both sources exist', () => {
    const stats = [...playInterval('p1', 0, 10), ...playInterval('p2', 0, 20)]
    const result = computePlayTimes({ stats, tablePlayTimes: { p1: 22 } }, TEST_FORMAT, NO_RENORMALISATION)

    const entry = entryFor(result.entries, 'p1')
    expect(entry?.source).toBe('blended')
    // 0.6 * 22 + 0.4 * 10 = 13.2 + 4 = 17.2
    expect(entry?.rawMinutes).toBeCloseTo(17.2, 5)
    expect(entry?.minutes).toBeCloseTo(17.2, 5)
    // p2 has events only.
    expect(entryFor(result.entries, 'p2')?.source).toBe('computed')
    expect(entryFor(result.entries, 'p2')?.minutes).toBeCloseTo(20, 5)
  })

  it('lets the sheet value stand alone when only the table has data for that player', () => {
    const stats = [...playInterval('p1', 0, 10)]
    const result = computePlayTimes({ stats, tablePlayTimes: { p2: 12 } }, TEST_FORMAT, NO_RENORMALISATION)

    const entry = entryFor(result.entries, 'p2')
    expect(entry?.source).toBe('table')
    expect(entry?.minutes).toBe(12)
    expect(entry?.rawMinutes).toBe(12)
  })

  it('clamps a blended value that overshoots the physical ceiling', () => {
    // 0.6 * 28 + 0.4 * 60 = 16.8 + 24 = 40.8 -> clamped to 28.
    const stats = [...playInterval('p1', 0, 60)]
    const result = computePlayTimes({ stats, tablePlayTimes: { p1: 28 } }, TEST_FORMAT, NO_RENORMALISATION)

    const entry = entryFor(result.entries, 'p1')
    expect(entry?.source).toBe('blended')
    expect(entry?.rawMinutes).toBeCloseTo(40.8, 5)
    expect(entry?.minutes).toBe(CEILING)
  })

  it('clamps a table value above the physical ceiling', () => {
    const result = computePlayTimes({ stats: [stat('gameStop', null, 5)], tablePlayTimes: { p1: 40 } }, TEST_FORMAT)

    expect(entryFor(result.entries, 'p1')?.minutes).toBe(CEILING)
    expect(entryFor(result.entries, 'p1')?.source).toBe('table')
  })

  it('ignores invalid table values and falls back to the computed value', () => {
    const stats = [...playInterval('p1', 0, 12), ...playInterval('p2', 0, 12)]
    const result = computePlayTimes(
      { stats, tablePlayTimes: { p1: -5, p3: Number.NaN, p4: Number.POSITIVE_INFINITY } },
      TEST_FORMAT,
      NO_RENORMALISATION
    )

    expect(entryFor(result.entries, 'p1')?.source).toBe('computed')
    expect(entryFor(result.entries, 'p1')?.minutes).toBe(12)
    // Invalid values are treated as absent: a player with no substitutions stays out entirely.
    expect(entryFor(result.entries, 'p3')).toBeUndefined()
    expect(entryFor(result.entries, 'p4')).toBeUndefined()
  })

  it('does not rescale a sheet-only match onto the theoretical total', () => {
    // Eleven table players sum to 220 > 140: without event data the sheet yields to nothing.
    const tablePlayTimes: Record<string, number> = {}
    for (let index = 1; index <= 11; index += 1) {
      tablePlayTimes[`t${index}`] = 20
    }
    const result = computePlayTimes({ stats: [stat('gameStop', null, 5)], tablePlayTimes }, TEST_FORMAT)

    expect(result.quality.tableTotalMinutes).toBe(220)
    expect(result.quality.eventsTotalMinutes).toBe(0)
    expect(result.renormalised).toBe(false)
    for (const entry of result.entries) {
      expect(entry.source).toBe('table')
      expect(entry.minutes).toBe(20)
    }
  })

  it('exposes a null quality gap when only one source carries data', () => {
    // Sheet-only: the events sum is 0, so no gap can be computed.
    const sheetOnly = computePlayTimes({ stats: [stat('gameStop', null, 5)], tablePlayTimes: { t1: 12 } }, TEST_FORMAT)
    expect(sheetOnly.quality.tableTotalMinutes).toBe(12)
    expect(sheetOnly.quality.eventsTotalMinutes).toBe(0)
    expect(sheetOnly.quality.gap).toBeNull()
    expect(sheetOnly.quality.percentage).toBeNull()

    // Events-only: the sheet sum is 0.
    const eventsOnly = computePlayTimes({ stats: playInterval('e1', 0, 10) }, TEST_FORMAT)
    expect(eventsOnly.quality.tableTotalMinutes).toBe(0)
    expect(eventsOnly.quality.eventsTotalMinutes).toBe(10)
    expect(eventsOnly.quality.gap).toBeNull()
    expect(eventsOnly.quality.percentage).toBeNull()
  })

  it('reports a quality gap when both sums are non-zero', () => {
    const stats = [...playInterval('e1', 0, 10)]
    const result = computePlayTimes({ stats, tablePlayTimes: { t1: 12 } }, TEST_FORMAT)

    // |12 - 10| / 140 = 0.014285... which sits under the flat threshold, so full quality.
    expect(result.quality.gap).toBeCloseTo(2 / THEORETICAL, 10)
    expect(result.quality.percentage).toBe(1)
  })

  it('never produces NaN or Infinity for any produced value', () => {
    const stats = [
      ...playInterval('p1', 0, 60),
      stat('fiveOut', 'p2', 4),
      stat('fiveIn', 'p3', 55),
      stat('gameStop', null, 60),
    ]
    const result = computePlayTimes({ stats, tablePlayTimes: { p6: 90, p7: -3 } }, TEST_FORMAT)

    const numbers = [
      result.deviationRatio,
      result.quality.eventsTotalMinutes,
      result.quality.tableTotalMinutes,
      ...result.entries.flatMap((entry) => [entry.minutes, entry.rawMinutes]),
    ]
    for (const value of numbers) {
      expect(Number.isFinite(value)).toBe(true)
    }
    for (const value of [result.quality.gap, result.quality.percentage]) {
      expect(value === null || Number.isFinite(value)).toBe(true)
    }
  })
})

describe('play time quality curve', () => {
  // Drive the public entry point: one sheet player and one events player, so the gap
  // is |sheet - events| / theoretical with both sums non-zero.
  function qualityPercentageForGap(gap: number): number | null {
    const eventsMinutes = 10
    const tableMinutes = eventsMinutes + gap * THEORETICAL
    const result = computePlayTimes(
      { stats: playInterval('e1', 0, eventsMinutes), tablePlayTimes: { t1: tableMinutes } },
      TEST_FORMAT,
      NO_RENORMALISATION
    )
    return result.quality.percentage
  }

  it('scores full quality while the gap stays at or under the flat threshold (3%)', () => {
    expect(qualityPercentageForGap(0)).toBe(1)
    expect(qualityPercentageForGap(0.03)).toBe(1)
  })

  it('scores zero at or above the zero-gap threshold (25%)', () => {
    expect(qualityPercentageForGap(0.25)).toBe(0)
    expect(qualityPercentageForGap(0.9)).toBe(0)
  })

  it('descends linearly between the two thresholds', () => {
    // Midpoint of 3% and 25% is 14%: (0.25 - 0.14) / (0.25 - 0.03) = 0.5
    expect(qualityPercentageForGap(0.14)).toBeCloseTo(0.5, 10)
  })
})
