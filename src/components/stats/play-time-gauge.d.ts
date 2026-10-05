import type { PlayTimeSourceQuality } from '../../libs/stats/play-time'

export interface BsPlayTimeGaugeProps {
  /** Legend-dot colour class, e.g. `bg-primary` (official sheet) or `bg-secondary` (coach tracking). */
  dotClass: string
  /** Concordance of this single source against the theoretical total. */
  source: PlayTimeSourceQuality
  /** Theoretical total for the resolved match format, in player-minutes. */
  theoreticalMinutes: number
  /** Always-visible French heading, e.g. "Feuille officielle" or "Suivi du coach". */
  title: string
}
