import type { PlayTimeQuality } from '../../libs/stats/play-time'

export interface BsPlayTimeGaugeProps {
  quality: PlayTimeQuality
  /** Theoretical total for the resolved match format, in player-minutes. */
  theoreticalMinutes: number
}
