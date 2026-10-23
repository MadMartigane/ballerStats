import type { MatchClockData } from './clock.d'

const MS_PER_SECOND = 1000
const MS_PER_MINUTE = 60_000
const FINAL_MINUTE_MS = MS_PER_MINUTE
const TENTHS_MS = 100
const STOPPED_ANCHOR_EPOCH_MS = 0
const ZERO_CLOCK_DISPLAY = '00.0'
const SECONDS_PAD_LENGTH = 2

/** FIBA/FFBB standard overtime length. Not part of `MatchFormatConfig` in this palier. */
export const OVERTIME_PERIOD_MINUTES = 5

/** Periods are 1-based. Any period strictly greater than the regulation count is an overtime. */
export function isOvertimePeriod(period: number, periodCount: number): boolean {
  return period > periodCount
}

/** Length in minutes of the given period: overtime length for overtimes, regulation length otherwise. */
export function getPeriodLengthMinutes(period: number, periodCount: number, periodLengthMinutes: number): number {
  return isOvertimePeriod(period, periodCount) ? OVERTIME_PERIOD_MINUTES : periodLengthMinutes
}

/** Fresh stopped clock for a period of the given length. */
export function createInitialClock(periodLengthMinutes: number): MatchClockData {
  return {
    anchorEpochMs: STOPPED_ANCHOR_EPOCH_MS,
    remainingMs: periodLengthMinutes * MS_PER_MINUTE,
    running: false,
  }
}

/** Remaining time at `nowMs`. Never negative. */
export function getRemainingMs(clock: MatchClockData, nowMs: number): number {
  if (!clock.running) {
    return clock.remainingMs
  }
  return Math.max(0, clock.remainingMs - (nowMs - clock.anchorEpochMs))
}

/** Start the clock at `nowMs`. No-op when already running. */
export function startClock(clock: MatchClockData, nowMs: number): MatchClockData {
  if (clock.running) {
    return clock
  }
  return { ...clock, anchorEpochMs: nowMs, running: true }
}

/** Freeze the remaining time at `nowMs` and stop. No-op when already stopped. */
export function stopClock(clock: MatchClockData, nowMs: number): MatchClockData {
  if (!clock.running) {
    return clock
  }
  return {
    anchorEpochMs: STOPPED_ANCHOR_EPOCH_MS,
    remainingMs: getRemainingMs(clock, nowMs),
    running: false,
  }
}

/** Apply a manual correction, clamped between 0 and the period length. Keeps the running state. */
export function adjustClock(
  clock: MatchClockData,
  deltaMs: number,
  periodLengthMs: number,
  nowMs: number
): MatchClockData {
  const correctedRemainingMs = Math.min(Math.max(getRemainingMs(clock, nowMs) + deltaMs, 0), periodLengthMs)
  return {
    anchorEpochMs: clock.running ? nowMs : STOPPED_ANCHOR_EPOCH_MS,
    remainingMs: correctedRemainingMs,
    running: clock.running,
  }
}

/** Fresh stopped clock for a new period. */
export function nextPeriodClock(periodLengthMinutes: number): MatchClockData {
  return createInitialClock(periodLengthMinutes)
}

function padTwoDigits(value: number): string {
  return String(value).padStart(SECONDS_PAD_LENGTH, '0')
}

/** `MM:SS` above one minute, `SS.T` (tenths, floored) under one minute, `00.0` at zero. */
export function formatClockDisplay(remainingMs: number): string {
  if (remainingMs <= 0) {
    return ZERO_CLOCK_DISPLAY
  }

  if (remainingMs > FINAL_MINUTE_MS) {
    const totalSeconds = Math.floor(remainingMs / MS_PER_SECOND)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`
  }

  const wholeSeconds = Math.floor(remainingMs / MS_PER_SECOND)
  const tenths = Math.floor((remainingMs % MS_PER_SECOND) / TENTHS_MS)
  return `${padTwoDigits(wholeSeconds)}.${tenths}`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Structural guard for persisted clock data, mirroring `isMatchFormatConfig`. */
export function isClockData(value: unknown): value is MatchClockData {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    isFiniteNumber(candidate.anchorEpochMs) &&
    isFiniteNumber(candidate.remainingMs) &&
    candidate.remainingMs >= 0 &&
    typeof candidate.running === 'boolean'
  )
}
