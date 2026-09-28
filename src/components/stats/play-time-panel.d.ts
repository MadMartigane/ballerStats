import type { StatMatchSummary } from '../../libs/stats/stats.d'
import type { ResolvedMatchFormat } from '../../libs/team/match-format'

export interface BsPlayTimePanelProps {
  format: ResolvedMatchFormat
  summary: StatMatchSummary
}
