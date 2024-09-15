import { MatchType } from '../../libs/match'

export type BsScoreCardProps = {
  localScore: number
  visitorScore: number
  date?: string | null
  location?: MatchType
  localName?: string | null
  visitorName?: string | null
}
