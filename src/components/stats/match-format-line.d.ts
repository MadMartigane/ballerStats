import type Match from '../../libs/match/match'
import type { MatchRawData } from '../../libs/match/match.d'
import type { AgeCategory, ResolvedMatchFormat } from '../../libs/team/match-format'

export interface BsMatchFormatLineProps {
  category?: AgeCategory | null
  format: ResolvedMatchFormat
  match: Match
  onSaved: (raw: MatchRawData) => void
}
