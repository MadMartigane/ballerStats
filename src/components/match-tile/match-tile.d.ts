import Match from '../../libs/match'
import type { MatchType } from '../../libs/match'
import { JSX } from 'solid-js'

export type BsMatchTileProps = {
  match: Match
  onEdit?: (match: Match) => void
  onStart?: (match: Match) => void
} & JSX.HTMLAttributes<HTMLDivElement>

export type BsMatchTypeTextProps = {
  type: MatchType
} & JSX.HTMLAttributes<HTMLSpanElement>
