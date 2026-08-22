import type { JSX } from 'solid-js'
import type { DaisySize } from '../../libs/daisy/daisy.d'
import type Match from '../../libs/match/match'
import type { MatchType } from '../../libs/match/match.d'

export type BsMatchTileProps = {
  match: Match
  onEdit?: (match: Match) => void
  onStart?: (match: Match) => void
} & JSX.HTMLAttributes<HTMLDivElement>

export type BsMatchTypeProps = {
  type?: MatchType
  size?: DaisySize
} & JSX.HTMLAttributes<HTMLSpanElement>
