import type { MatchClockData } from '../../libs/match/clock.d'

export interface BsMatchClockProps {
  /** Live clock snapshot. The component never mutates it. */
  clock: MatchClockData
  /** 1-based index of the period currently in progress. */
  currentPeriod: number
  /** Invoked on a ±1 s correction. The owner applies the delta. */
  onAdjust: (deltaMs: number) => void
  /** Invoked when the user clicks a period chip (1-based). */
  onSelectPeriod: (period: number) => void
  /** Invoked when the user clicks the main control. Carries the next running state. */
  onToggleRunning: (nextRunning: boolean) => void
  /** Total number of regulation periods from the resolved match format. */
  periodCount: number
}
