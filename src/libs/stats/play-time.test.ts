import { describe, expect, it } from 'vitest'
import type { MatchStatLogEntry } from '../match/match.d'
import type { MatchFormatConfig } from '../team/match-format'
import type { PlayTimeEntry, PlayTimeQuality } from './play-time'
import { computePlayTimes, computePlayTimeWeight, PLAY_TIME_TABLE_WEIGHT, scorePlayTimeGap } from './play-time'

/** Generic 4 x 7 format: ceiling 28 min, theoretical total 140 min. */
const TEST_FORMAT: MatchFormatConfig = { periodLengthMinutes: 7, periods: 4, playersOnCourt: 5 }
const CEILING = 28
const THEORETICAL = 140

const MINUTE = 60_000
const BASE_TIMESTAMP = 1_700_000_000_000

/**
 * Historical engine tolerance (10 %), deleted when renormalisation became systematic so a
 * small-but-real deviation is corrected rather than left inside a dead-band. These assertions
 * still pin the OLD dead-band boundary: the first shows a -1.4 % deviation sat inside it while
 * renormalisation now fires anyway; the second shows a deviation far outside it, where
 * renormalisation stands down for a different reason (the sheet consumed the budget).
 */
const LEGACY_TOLERANCE = 0.1

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

/**
 * Hand-built quality block with explicit percentage scores, so the weight maths is exercised
 * independently of the scoring curve that produces those scores in production.
 */
function literalQuality(tablePercentage: number | null, eventsPercentage: number | null): PlayTimeQuality {
  return {
    events: { gap: null, percentage: eventsPercentage, totalMinutes: 0 },
    gap: null,
    percentage: null,
    table: { gap: null, percentage: tablePercentage, totalMinutes: 0 },
  }
}

describe('computePlayTimes', () => {
  it('returns an empty result for a match without stats', () => {
    const result = computePlayTimes({ stats: [] }, TEST_FORMAT)

    expect(result.entries).toEqual([])
    expect(result.quality.events.totalMinutes).toBe(0)
    expect(result.quality.table.totalMinutes).toBe(0)
    expect(result.quality.gap).toBeNull()
    expect(result.quality.percentage).toBeNull()
    expect(result.quality.events.percentage).toBeNull()
    expect(result.quality.table.percentage).toBeNull()
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
    expect(result.quality.events.totalMinutes).toBe(0)
    // The quality metric reads the raw sheet sum (12 + 40), unclamped.
    expect(result.quality.table.totalMinutes).toBe(52)
    expect(result.quality.events.percentage).toBeNull()
    expect(result.quality.gap).toBeNull()
    expect(result.renormalised).toBe(false)
  })

  it('sums closed intervals and closes an open interval at the last event timestamp', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 0, 5), stat('foul', null, 30), stat('fiveIn', 'p2', 10)]
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(5)
    expect(entryFor(result.entries, 'p2')?.rawMinutes).toBe(20)
    expect(result.quality.events.totalMinutes).toBe(25)
  })

  it('uses the max timestamp over all stats, including non-substitution events, as the window end', () => {
    const stats: MatchStatLogEntry[] = [stat('fiveIn', 'p1', 0), stat('gameStop', null, 6)]
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(6)
  })

  it('omits a player who has stats but no fiveIn event', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 0, 5), stat('2pts', 'p2', 3)]
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(result.entries.map((entry) => entry.playerId)).toEqual(['p1'])
  })

  it('ignores a fiveOut without a matching fiveIn', () => {
    const stats: MatchStatLogEntry[] = [stat('fiveOut', 'p1', 5), stat('foul', null, 10)]
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(0)
    expect(result.quality.events.totalMinutes).toBe(0)
    expect(result.renormalised).toBe(false)
  })

  it('restarts the open interval on a double-IN, dropping the dangling earlier one', () => {
    const stats: MatchStatLogEntry[] = [stat('fiveIn', 'p1', 0), stat('fiveIn', 'p1', 3), stat('fiveOut', 'p1', 8)]
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(5)
  })

  it('gives zero live minutes to an interval lying entirely inside a dead-ball window', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 3, 7), gameStop(2), gameStop(8), stat('foul', null, 8)]
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(0)
  })

  it('keeps only the live part of an interval partially overlapping a dead-ball window', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 0, 10), gameStop(2), gameStop(8)]
    const result = computePlayTimes({ stats }, TEST_FORMAT)

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
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    // [0,2] + [4,6] + [8,10] = 6 min live.
    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(6)
  })

  it('ignores a trailing unpaired gameStop', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 0, 10), gameStop(2), gameStop(8), gameStop(12)]
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    // The [2,8] window is live-excluded; the dangling 12 is ignored (match stopped at the whistle).
    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(4)
  })

  it('never counts the opponent sentinel as one of our players', () => {
    const stats: MatchStatLogEntry[] = [
      ...playInterval('OPPONENT', 0, 20),
      ...playInterval('p1', 0, 5),
      stat('gameStop', null, 20),
    ]
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(result.entries.map((entry) => entry.playerId)).toEqual(['p1'])
  })

  it('keeps raw values without dividing by zero when nothing was measured', () => {
    const stats: MatchStatLogEntry[] = [stat('fiveOut', 'p1', 5), stat('foul', null, 10)]
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(result.quality.events.totalMinutes).toBe(0)
    expect(result.renormalised).toBe(false)
    expect(result.deviationRatio).toBe(0)
    for (const entry of result.entries) {
      expect(Number.isFinite(entry.minutes)).toBe(true)
    }
  })

  it('renormalises systematically when the deviation is small but real', () => {
    // Five players on court almost the whole match: 5 x 27.6 = 138 min, deviation -1.4%.
    const stats = [
      ...playInterval('p1', 0, 27.6),
      ...playInterval('p2', 0, 27.6),
      ...playInterval('p3', 0, 27.6),
      ...playInterval('p4', 0, 27.6),
      ...playInterval('p5', 0, 27.6),
    ]
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(result.quality.events.totalMinutes).toBeCloseTo(138, 5)
    // The deviation sits inside the old tolerance, yet renormalisation now fires anyway.
    expect(Math.abs(result.deviationRatio)).toBeLessThanOrEqual(LEGACY_TOLERANCE)
    expect(result.renormalised).toBe(true)

    const entry = entryFor(result.entries, 'p1')
    expect(entry?.rawMinutes).toBeCloseTo(27.6, 5)
    // Factor 140/138 applied to 27.6 yields 28 exactly, so the closing sum is exact too.
    expect(entry?.minutes).toBeCloseTo((THEORETICAL / 138) * 27.6, 5)
    const summed = result.entries.reduce((total, current) => total + current.minutes, 0)
    expect(summed).toBeCloseTo(THEORETICAL, 5)
  })

  it('renormalises onto the theoretical total when the deviation exceeds tolerance', () => {
    // Eight players x 20 min = 160 min, deviation +14.3%.
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
    const stats = playerIds.flatMap((playerId) => playInterval(playerId, 0, 20))
    const result = computePlayTimes({ stats }, TEST_FORMAT)

    expect(result.quality.events.totalMinutes).toBeCloseTo(160, 5)
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
    // events 12) and one events-only player at 10. The sheet consumed the budget, so
    // remainingTheoreticalMinutes is 0: renormalisation must stand down and both measured
    // entries keep their own records rather than being multiplied by 0.
    const stats = [...playInterval('b1', 0, 12), ...playInterval('e1', 0, 10)]
    const tablePlayTimes: Record<string, number> = { b1: 10 }
    for (let index = 1; index <= 6; index += 1) {
      tablePlayTimes[`t${index}`] = 27
    }
    const result = computePlayTimes({ stats, tablePlayTimes }, TEST_FORMAT)

    expect(Math.abs(result.deviationRatio)).toBeGreaterThan(LEGACY_TOLERANCE)
    expect(result.renormalised).toBe(false)

    const blended = entryFor(result.entries, 'b1')
    // The table scores ~0.097 and the events score 0, so the sheet weight clamps to its
    // 0.7 ceiling: 0.7 * 10 + 0.3 * 12 = 10.6.
    expect(blended?.rawMinutes).toBeCloseTo(10.6, 5)
    expect(blended?.minutes).toBeCloseTo(10.6, 5)
    expect(blended?.minutes).toBeGreaterThan(0)

    const computed = entryFor(result.entries, 'e1')
    expect(computed?.minutes).toBeCloseTo(10, 5)
    expect(computed?.minutes).toBeGreaterThan(0)

    for (const index of [1, 2, 3, 4, 5, 6]) {
      expect(entryFor(result.entries, `t${index}`)?.minutes).toBe(27)
    }
  })

  it('falls back to the 60/40 sheet weight when both sources score zero', () => {
    const stats = [...playInterval('p1', 0, 10), ...playInterval('p2', 0, 20)]
    const result = computePlayTimes({ stats, tablePlayTimes: { p1: 22 } }, TEST_FORMAT)

    // Both totals sit far below the theoretical total, so both per-source scores bottom out.
    expect(result.quality.events.percentage).toBe(0)
    expect(result.quality.table.percentage).toBe(0)
    expect(computePlayTimeWeight(result.quality)).toBe(PLAY_TIME_TABLE_WEIGHT)

    const entry = entryFor(result.entries, 'p1')
    expect(entry?.source).toBe('blended')
    // 0.6 * 22 + 0.4 * 10 = 13.2 + 4 = 17.2
    expect(entry?.rawMinutes).toBeCloseTo(17.2, 5)
    // p2 has events only.
    expect(entryFor(result.entries, 'p2')?.source).toBe('computed')
  })

  it('lets the sheet value stand alone when only the table has data for that player', () => {
    const stats = [...playInterval('p1', 0, 10)]
    const result = computePlayTimes({ stats, tablePlayTimes: { p2: 12 } }, TEST_FORMAT)

    const entry = entryFor(result.entries, 'p2')
    expect(entry?.source).toBe('table')
    expect(entry?.minutes).toBe(12)
    expect(entry?.rawMinutes).toBe(12)
  })

  it('leaves events-only entries untouched by the sheet weight', () => {
    const result = computePlayTimes({ stats: playInterval('e1', 0, 10) }, TEST_FORMAT)

    const entry = entryFor(result.entries, 'e1')
    expect(entry?.source).toBe('computed')
    expect(entry?.rawMinutes).toBe(10)
    // Only the events measured this player, so the weight never applies; renormalisation
    // still rescales the events union onto the theoretical total, clamped last.
    expect(entry?.minutes).toBe(CEILING)
  })

  it('clamps a blended value that overshoots the physical ceiling', () => {
    // 0.6 * 28 + 0.4 * 60 = 16.8 + 24 = 40.8 -> clamped to 28.
    const stats = [...playInterval('p1', 0, 60)]
    const result = computePlayTimes({ stats, tablePlayTimes: { p1: 28 } }, TEST_FORMAT)

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
      TEST_FORMAT
    )

    const entry = entryFor(result.entries, 'p1')
    expect(entry?.source).toBe('computed')
    expect(entry?.rawMinutes).toBe(12)
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

    expect(result.quality.table.totalMinutes).toBe(220)
    expect(result.quality.events.totalMinutes).toBe(0)
    expect(result.quality.events.percentage).toBeNull()
    expect(result.renormalised).toBe(false)
    for (const entry of result.entries) {
      expect(entry.source).toBe('table')
      expect(entry.minutes).toBe(20)
    }
  })

  it('exposes a null quality gap when only one source carries data', () => {
    // Sheet-only: the events sum is 0, so no gap can be computed.
    const sheetOnly = computePlayTimes({ stats: [stat('gameStop', null, 5)], tablePlayTimes: { t1: 12 } }, TEST_FORMAT)
    expect(sheetOnly.quality.table.totalMinutes).toBe(12)
    expect(sheetOnly.quality.events.totalMinutes).toBe(0)
    expect(sheetOnly.quality.gap).toBeNull()
    expect(sheetOnly.quality.percentage).toBeNull()
    expect(sheetOnly.quality.events.percentage).toBeNull()

    // Events-only: the sheet sum is 0.
    const eventsOnly = computePlayTimes({ stats: playInterval('e1', 0, 10) }, TEST_FORMAT)
    expect(eventsOnly.quality.table.totalMinutes).toBe(0)
    expect(eventsOnly.quality.events.totalMinutes).toBe(10)
    expect(eventsOnly.quality.gap).toBeNull()
    expect(eventsOnly.quality.percentage).toBeNull()
    expect(eventsOnly.quality.table.percentage).toBeNull()
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
      result.quality.events.totalMinutes,
      result.quality.table.totalMinutes,
      ...result.entries.flatMap((entry) => [entry.minutes, entry.rawMinutes]),
    ]
    for (const value of numbers) {
      expect(Number.isFinite(value)).toBe(true)
    }
    for (const value of [
      result.quality.gap,
      result.quality.percentage,
      result.quality.events.gap,
      result.quality.events.percentage,
      result.quality.table.gap,
      result.quality.table.percentage,
    ]) {
      expect(value === null || Number.isFinite(value)).toBe(true)
    }
  })
})

describe('per-source quality scores', () => {
  it('nulls the score of a source that measured nothing', () => {
    const sheetOnly = computePlayTimes(
      { stats: [stat('gameStop', null, 5)], tablePlayTimes: { t1: 12 } },
      TEST_FORMAT
    ).quality
    expect(sheetOnly.events.totalMinutes).toBe(0)
    expect(sheetOnly.events.percentage).toBeNull()
    expect(sheetOnly.table.totalMinutes).toBe(12)
    expect(sheetOnly.table.percentage).toBe(0)

    const eventsOnly = computePlayTimes({ stats: playInterval('e1', 0, 10) }, TEST_FORMAT).quality
    expect(eventsOnly.table.totalMinutes).toBe(0)
    expect(eventsOnly.table.percentage).toBeNull()
    expect(eventsOnly.events.totalMinutes).toBe(10)
    expect(eventsOnly.events.percentage).toBe(0)
  })

  it('keeps the table total raw so an over-ceiling sheet value lowers the score', () => {
    const { table } = computePlayTimes(
      { stats: playInterval('e1', 0, 10), tablePlayTimes: { t1: 40 } },
      TEST_FORMAT
    ).quality

    // 40 is clamped to 28 for the entry, but the score reads the raw 40 and bottoms out.
    expect(table.totalMinutes).toBe(40)
    expect(table.percentage).toBe(0)
  })
})

describe('computePlayTimeWeight', () => {
  it('splits the blend by the two scores when both are positive', () => {
    // 0.4 / (0.4 + 0.44) = 0.476190...
    expect(computePlayTimeWeight(literalQuality(0.4, 0.44))).toBeCloseTo(0.476_190_5, 6)
  })

  it('clamps the sheet share to the floor and the ceiling', () => {
    // Sheet scores zero: its share bottoms out at the floor.
    expect(computePlayTimeWeight(literalQuality(0, 0.8))).toBe(0.3)
    // Events score zero: the sheet owns the whole score, so its share tops out.
    expect(computePlayTimeWeight(literalQuality(0.8, 0))).toBe(0.7)
  })

  it('falls back to the 60/40 default when neither source scores', () => {
    expect(computePlayTimeWeight(literalQuality(0, 0))).toBe(PLAY_TIME_TABLE_WEIGHT)
  })

  it('falls back to the 60/40 default when both sources are unmeasured', () => {
    expect(computePlayTimeWeight(literalQuality(null, null))).toBe(PLAY_TIME_TABLE_WEIGHT)
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
      TEST_FORMAT
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

  it('applies the same curve to a per-source score', () => {
    expect(scorePlayTimeGap(0)).toBe(1)
    expect(scorePlayTimeGap(0.03)).toBe(1)
    expect(scorePlayTimeGap(0.14)).toBeCloseTo(0.5, 10)
    expect(scorePlayTimeGap(0.25)).toBe(0)
    expect(scorePlayTimeGap(0.9)).toBe(0)
  })
})
