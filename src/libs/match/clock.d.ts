/** Snapshot of the game clock persisted inside a match. */
export interface MatchClockData {
  /**
   * Wall-clock anchor: a `Date.now()` epoch millisecond value taken at the last transition.
   * Only meaningful while `running` is true, otherwise `0`.
   * This is NOT a monotonic `performance.now()` value: a monotonic value resets on page reload,
   * which would corrupt a persisted anchor.
   */
  anchorEpochMs: number
  /** Remaining time in the current period, in milliseconds, frozen at the last transition. */
  remainingMs: number
  /** True when the clock is running. */
  running: boolean
}
