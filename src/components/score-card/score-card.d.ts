import { MatchType } from "../../libs/match"

export type BsScoreCardProps = {
  localScore: number
  visitorScore: number
  location?: MatchType
  localName?: string | null
  visitorName?: string | null
}
