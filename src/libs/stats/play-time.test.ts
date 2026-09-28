import { describe, expect, it } from 'vitest'
import type { MatchStatLogEntry } from '../match/match.d'
import type { MatchFormatConfig } from '../team/match-format'
import type { PlayTimeEntry } from './play-time'
import { computePlayTimes, PLAY_TIME_TOLERANCE } from './play-time'

/** U13 4x7 format: ceiling 28 min, theoretical total 140 min. */
const U13_FORMAT: MatchFormatConfig = { periodLengthMinutes: 7, periods: 4, playersOnCourt: 5 }
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
    const result = computePlayTimes({ stats: [] }, U13_FORMAT)

    expect(result.entries).toEqual([])
    expect(result.measuredTotalMinutes).toBe(0)
    expect(result.deviationRatio).toBe(0)
    expect(result.renormalised).toBe(false)
    expect(result.remainingTheoreticalMinutes).toBe(THEORETICAL)
  })

  it('treats a missing stats field like an empty match', () => {
    const result = computePlayTimes({}, U13_FORMAT)

    expect(result.entries).toEqual([])
    expect(result.remainingTheoreticalMinutes).toBe(THEORETICAL)
  })

  it('keeps table-recorded times for a table-only match with zero stat events', () => {
    const result = computePlayTimes({ stats: [], tablePlayTimes: { p1: 12, p2: 40 } }, U13_FORMAT)

    expect(result.entries.map((entry) => entry.playerId)).toEqual(['p1', 'p2'])
    expect(entryFor(result.entries, 'p1')?.minutes).toBe(12)
    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(12)
    expect(entryFor(result.entries, 'p1')?.source).toBe('table')
    // 40 is clamped to the 28-minute ceiling; the source stays the table.
    expect(entryFor(result.entries, 'p2')?.minutes).toBe(CEILING)
    expect(result.measuredTotalMinutes).toBe(0)
    expect(result.renormalised).toBe(false)
    expect(result.remainingTheoreticalMinutes).toBe(THEORETICAL - CEILING - 12)
  })

  it('sums closed intervals and closes an open interval at the last event timestamp', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 0, 5), stat('foul', null, 30), stat('fiveIn', 'p2', 10)]
    const result = computePlayTimes({ stats }, U13_FORMAT, NO_RENORMALISATION)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(5)
    expect(entryFor(result.entries, 'p2')?.rawMinutes).toBe(20)
    expect(result.measuredTotalMinutes).toBe(25)
  })

  it('uses the max timestamp over all stats, including non-substitution events, as the window end', () => {
    const stats: MatchStatLogEntry[] = [stat('fiveIn', 'p1', 0), stat('gameStop', null, 6)]
    const result = computePlayTimes({ stats }, U13_FORMAT, NO_RENORMALISATION)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(6)
  })

  it('omits a player who has stats but no fiveIn event', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 0, 5), stat('2pts', 'p2', 3)]
    const result = computePlayTimes({ stats }, U13_FORMAT, NO_RENORMALISATION)

    expect(result.entries.map((entry) => entry.playerId)).toEqual(['p1'])
  })

  it('ignores a fiveOut without a matching fiveIn', () => {
    const stats: MatchStatLogEntry[] = [stat('fiveOut', 'p1', 5), stat('foul', null, 10)]
    const result = computePlayTimes({ stats }, U13_FORMAT, NO_RENORMALISATION)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(0)
    expect(result.measuredTotalMinutes).toBe(0)
    expect(result.renormalised).toBe(false)
  })

  it('restarts the open interval on a double-IN, dropping the dangling earlier one', () => {
    const stats: MatchStatLogEntry[] = [stat('fiveIn', 'p1', 0), stat('fiveIn', 'p1', 3), stat('fiveOut', 'p1', 8)]
    const result = computePlayTimes({ stats }, U13_FORMAT, NO_RENORMALISATION)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(5)
  })

  it('gives zero live minutes to an interval lying entirely inside a dead-ball window', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 3, 7), gameStop(2), gameStop(8), stat('foul', null, 8)]
    const result = computePlayTimes({ stats }, U13_FORMAT, NO_RENORMALISATION)

    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(0)
  })

  it('keeps only the live part of an interval partially overlapping a dead-ball window', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 0, 10), gameStop(2), gameStop(8)]
    const result = computePlayTimes({ stats }, U13_FORMAT, NO_RENORMALISATION)

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
    const result = computePlayTimes({ stats }, U13_FORMAT, NO_RENORMALISATION)

    // [0,2] + [4,6] + [8,10] = 6 min live.
    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(6)
  })

  it('ignores a trailing unpaired gameStop', () => {
    const stats: MatchStatLogEntry[] = [...playInterval('p1', 0, 10), gameStop(2), gameStop(8), gameStop(12)]
    const result = computePlayTimes({ stats }, U13_FORMAT, NO_RENORMALISATION)

    // The [2,8] window is live-excluded; the dangling 12 is ignored (match stopped at the whistle).
    expect(entryFor(result.entries, 'p1')?.rawMinutes).toBe(4)
  })

  it('never counts the opponent sentinel as one of our players', () => {
    const stats: MatchStatLogEntry[] = [
      ...playInterval('OPPONENT', 0, 20),
      ...playInterval('p1', 0, 5),
      stat('gameStop', null, 20),
    ]
    const result = computePlayTimes({ stats }, U13_FORMAT, NO_RENORMALISATION)

    expect(result.entries.map((entry) => entry.playerId)).toEqual(['p1'])
  })

  it('keeps raw values without dividing by zero when nothing was measured', () => {
    const stats: MatchStatLogEntry[] = [stat('fiveOut', 'p1', 5), stat('foul', null, 10)]
    const result = computePlayTimes({ stats }, U13_FORMAT)

    expect(result.measuredTotalMinutes).toBe(0)
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
    const result = computePlayTimes({ stats }, U13_FORMAT)

    expect(result.measuredTotalMinutes).toBeCloseTo(138, 5)
    expect(Math.abs(result.deviationRatio)).toBeLessThanOrEqual(PLAY_TIME_TOLERANCE)
    expect(result.renormalised).toBe(false)
    expect(entryFor(result.entries, 'p1')?.minutes).toBeCloseTo(27.6, 5)
  })

  it('renormalises onto the theoretical total when the deviation exceeds tolerance', () => {
    // Eight players x 20 min = 160 min, deviation +14.3%.
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
    const stats = playerIds.flatMap((playerId) => playInterval(playerId, 0, 20))
    const result = computePlayTimes({ stats }, U13_FORMAT)

    expect(result.measuredTotalMinutes).toBeCloseTo(160, 5)
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
    const result = computePlayTimes({ stats }, U13_FORMAT)

    expect(result.renormalised).toBe(true)
    // Clamping the raw first would have produced 28 x 0.7 = 19.6 instead.
    for (const playerId of playerIds) {
      const entry = entryFor(result.entries, playerId)
      expect(entry?.rawMinutes).toBeCloseTo(50, 5)
      expect(entry?.minutes).toBe(CEILING)
    }
  })

  it('lets a table value win over the computed value and never renormalise it', () => {
    const stats = [
      ...playInterval('p1', 0, 10),
      ...['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].flatMap((playerId) => playInterval(playerId, 0, 20)),
    ]
    const result = computePlayTimes({ stats, tablePlayTimes: { p1: 22 } }, U13_FORMAT)

    const tableEntry = entryFor(result.entries, 'p1')
    expect(tableEntry?.source).toBe('table')
    expect(tableEntry?.minutes).toBe(22)
    expect(tableEntry?.rawMinutes).toBe(22)
    expect(result.renormalised).toBe(true)
  })

  it('clamps a table value above the physical ceiling', () => {
    const result = computePlayTimes({ stats: [stat('gameStop', null, 5)], tablePlayTimes: { p1: 40 } }, U13_FORMAT)

    expect(entryFor(result.entries, 'p1')?.minutes).toBe(CEILING)
    expect(entryFor(result.entries, 'p1')?.source).toBe('table')
  })

  it('ignores invalid table values and falls back to the computed value', () => {
    const stats = [...playInterval('p1', 0, 12), ...playInterval('p2', 0, 12)]
    const result = computePlayTimes(
      { stats, tablePlayTimes: { p1: -5, p3: Number.NaN, p4: Number.POSITIVE_INFINITY } },
      U13_FORMAT,
      NO_RENORMALISATION
    )

    expect(entryFor(result.entries, 'p1')?.source).toBe('computed')
    expect(entryFor(result.entries, 'p1')?.minutes).toBe(12)
    // Invalid values are treated as absent: a player with no substitutions stays out entirely.
    expect(entryFor(result.entries, 'p3')).toBeUndefined()
    expect(entryFor(result.entries, 'p4')).toBeUndefined()
  })

  it('shares the remaining theoretical minutes between table and computed players', () => {
    const computedIds = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']
    const stats = computedIds.flatMap((playerId) => playInterval(playerId, 0, 20))
    // Two table players (25 + 25 = 50) leave 90 theoretical minutes for the eight computed ones.
    const tablePlayTimes = { t1: 25, t2: 25 }
    const result = computePlayTimes({ stats, tablePlayTimes }, U13_FORMAT)

    expect(result.remainingTheoreticalMinutes).toBe(90)
    expect(result.measuredTotalMinutes).toBeCloseTo(160, 5)
    expect(result.renormalised).toBe(true)

    for (const playerId of computedIds) {
      expect(entryFor(result.entries, playerId)?.minutes).toBeCloseTo(11.25, 5)
    }

    const summed = result.entries.reduce((total, entry) => total + entry.minutes, 0)
    expect(summed).toBeCloseTo(THEORETICAL, 5)
  })

  it('never produces NaN or Infinity for any produced value', () => {
    const stats = [
      ...playInterval('p1', 0, 60),
      stat('fiveOut', 'p2', 4),
      stat('fiveIn', 'p3', 55),
      stat('gameStop', null, 60),
    ]
    const result = computePlayTimes({ stats, tablePlayTimes: { p4: 90, p5: -3 } }, U13_FORMAT)

    const numbers = [
      result.measuredTotalMinutes,
      result.deviationRatio,
      result.remainingTheoreticalMinutes,
      ...result.entries.flatMap((entry) => [entry.minutes, entry.rawMinutes]),
    ]
    for (const value of numbers) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })
})
