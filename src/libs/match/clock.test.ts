import { describe, expect, it } from 'vitest'
import {
  adjustClock,
  createInitialClock,
  formatClockDisplay,
  getPeriodLengthMinutes,
  getRemainingMs,
  isClockData,
  isOvertimePeriod,
  nextPeriodClock,
  OVERTIME_PERIOD_MINUTES,
  startClock,
  stopClock,
} from './clock'
import type { MatchClockData } from './clock.d'

const PERIOD_LENGTH_MINUTES = 10
const PERIOD_LENGTH_MS = PERIOD_LENGTH_MINUTES * 60_000
const REGULATION_PERIOD_COUNT = 4
const START_EPOCH_MS = 1_000_000
const ONE_SECOND_MS = 1000
const ONE_MINUTE_MS = 60_000

function makeRunningClock(remainingMs: number, anchorEpochMs: number): MatchClockData {
  return { anchorEpochMs, remainingMs, running: true }
}

describe('clock: creation and reading', () => {
  it('creates a stopped clock at the full period length', () => {
    expect(createInitialClock(PERIOD_LENGTH_MINUTES)).toEqual({
      anchorEpochMs: 0,
      remainingMs: PERIOD_LENGTH_MS,
      running: false,
    })
  })

  it('returns frozen remaining time when stopped regardless of nowMs', () => {
    const clock = createInitialClock(PERIOD_LENGTH_MINUTES)
    expect(getRemainingMs(clock, START_EPOCH_MS + 999_999)).toBe(PERIOD_LENGTH_MS)
  })

  it('decreases remaining time while running', () => {
    const clock = startClock(createInitialClock(PERIOD_LENGTH_MINUTES), START_EPOCH_MS)
    expect(getRemainingMs(clock, START_EPOCH_MS + 5000)).toBe(PERIOD_LENGTH_MS - 5000)
  })

  it('never returns negative remaining time', () => {
    const clock = makeRunningClock(2000, START_EPOCH_MS)
    expect(getRemainingMs(clock, START_EPOCH_MS + 60_000)).toBe(0)
  })
})

describe('clock: start and stop', () => {
  it('freezes remaining time on a stop after a start', () => {
    const started = startClock(createInitialClock(PERIOD_LENGTH_MINUTES), START_EPOCH_MS)
    const stopped = stopClock(started, START_EPOCH_MS + 12_500)
    expect(stopped).toEqual({ anchorEpochMs: 0, remainingMs: PERIOD_LENGTH_MS - 12_500, running: false })
    expect(getRemainingMs(stopped, START_EPOCH_MS + 99_000)).toBe(PERIOD_LENGTH_MS - 12_500)
  })

  it('accumulates drift-free across repeated start and stop cycles', () => {
    let clock = createInitialClock(PERIOD_LENGTH_MINUTES)
    clock = startClock(clock, START_EPOCH_MS)
    clock = stopClock(clock, START_EPOCH_MS + 3000)
    clock = startClock(clock, START_EPOCH_MS + 10_000)
    clock = stopClock(clock, START_EPOCH_MS + 14_000)
    clock = startClock(clock, START_EPOCH_MS + 50_000)
    clock = stopClock(clock, START_EPOCH_MS + 52_000)
    expect(clock.remainingMs).toBe(PERIOD_LENGTH_MS - (3000 + 4000 + 2000))
  })

  it('ignores a second start while already running', () => {
    const running = startClock(createInitialClock(PERIOD_LENGTH_MINUTES), START_EPOCH_MS)
    expect(startClock(running, START_EPOCH_MS + 4000)).toBe(running)
  })

  it('ignores a stop while already stopped', () => {
    const stopped = createInitialClock(PERIOD_LENGTH_MINUTES)
    expect(stopClock(stopped, START_EPOCH_MS + 4000)).toBe(stopped)
  })
})

describe('clock: manual adjustment', () => {
  it('adds time when adjusting up while stopped', () => {
    const stopped = { anchorEpochMs: 0, remainingMs: 30_000, running: false }
    const adjusted = adjustClock(stopped, ONE_SECOND_MS, PERIOD_LENGTH_MS, START_EPOCH_MS)
    expect(adjusted).toEqual({ anchorEpochMs: 0, remainingMs: 31_000, running: false })
  })

  it('removes time when adjusting down while running and re-anchors', () => {
    const running = makeRunningClock(30_000, START_EPOCH_MS)
    const adjusted = adjustClock(running, -ONE_SECOND_MS, PERIOD_LENGTH_MS, START_EPOCH_MS + 5000)
    expect(adjusted).toEqual({ anchorEpochMs: START_EPOCH_MS + 5000, remainingMs: 24_000, running: true })
  })

  it('clamps at zero when adjusting below the floor', () => {
    const stopped = { anchorEpochMs: 0, remainingMs: 400, running: false }
    expect(adjustClock(stopped, -ONE_SECOND_MS, PERIOD_LENGTH_MS, START_EPOCH_MS).remainingMs).toBe(0)
  })

  it('clamps at the period length when adjusting above the ceiling', () => {
    const stopped = { anchorEpochMs: 0, remainingMs: PERIOD_LENGTH_MS - 400, running: false }
    expect(adjustClock(stopped, ONE_SECOND_MS, PERIOD_LENGTH_MS, START_EPOCH_MS).remainingMs).toBe(PERIOD_LENGTH_MS)
  })
})

describe('clock: display formatting', () => {
  it('formats full period as MM:SS', () => {
    expect(formatClockDisplay(PERIOD_LENGTH_MS)).toBe('10:00')
  })

  it('formats MM:SS with zero-padded seconds above one minute', () => {
    expect(formatClockDisplay(9 * ONE_MINUTE_MS + 41 * ONE_SECOND_MS + 900)).toBe('09:41')
  })

  it('switches to SS.T at exactly one minute and below', () => {
    expect(formatClockDisplay(ONE_MINUTE_MS)).toBe('60.0')
    expect(formatClockDisplay(ONE_MINUTE_MS - 1)).toBe('59.9')
  })

  it('floors tenths under the final minute', () => {
    expect(formatClockDisplay(41_399)).toBe('41.3')
  })

  it('shows 00.0 at exactly zero', () => {
    expect(formatClockDisplay(0)).toBe('00.0')
  })
})

describe('clock: guard', () => {
  it('accepts a well-formed clock snapshot', () => {
    expect(isClockData({ anchorEpochMs: 0, remainingMs: 600_000, running: false })).toBe(true)
  })

  it('rejects a snapshot missing a field', () => {
    expect(isClockData({ anchorEpochMs: 0, running: false })).toBe(false)
  })

  it('rejects a snapshot with negative remaining time', () => {
    expect(isClockData({ anchorEpochMs: 0, remainingMs: -1, running: false })).toBe(false)
  })
})

describe('clock: period helpers', () => {
  it('classifies regulation periods and the boundary as non-overtime', () => {
    expect(isOvertimePeriod(1, REGULATION_PERIOD_COUNT)).toBe(false)
    expect(isOvertimePeriod(REGULATION_PERIOD_COUNT, REGULATION_PERIOD_COUNT)).toBe(false)
  })

  it('classifies the first and later periods past the regulation count as overtime', () => {
    expect(isOvertimePeriod(REGULATION_PERIOD_COUNT + 1, REGULATION_PERIOD_COUNT)).toBe(true)
    expect(isOvertimePeriod(REGULATION_PERIOD_COUNT + 2, REGULATION_PERIOD_COUNT)).toBe(true)
  })

  it('uses the regulation length for regulation periods, including the last one', () => {
    expect(getPeriodLengthMinutes(REGULATION_PERIOD_COUNT, REGULATION_PERIOD_COUNT, PERIOD_LENGTH_MINUTES)).toBe(10)
  })

  it('uses the overtime length from the first overtime period onward', () => {
    expect(getPeriodLengthMinutes(REGULATION_PERIOD_COUNT + 1, REGULATION_PERIOD_COUNT, PERIOD_LENGTH_MINUTES)).toBe(
      OVERTIME_PERIOD_MINUTES
    )
    expect(OVERTIME_PERIOD_MINUTES).toBe(5)
  })

  it('builds a fresh stopped clock for the next period', () => {
    expect(nextPeriodClock(OVERTIME_PERIOD_MINUTES)).toEqual({
      anchorEpochMs: 0,
      remainingMs: 5 * ONE_MINUTE_MS,
      running: false,
    })
  })
})
