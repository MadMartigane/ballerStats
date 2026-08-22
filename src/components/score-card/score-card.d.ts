import type { MatchType } from '../../libs/match/match.d'

export interface BsScoreCardProps {
  date?: string | null
  localName?: string | null
  localScore: number
  location?: MatchType
  visitorName?: string | null
  visitorScore: number
}
