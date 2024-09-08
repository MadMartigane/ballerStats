import { DaisySize } from '../../libs/daisy'
import Match from '../../libs/match'
import type { MatchType } from '../../libs/match'
import { JSX } from 'solid-js'

export type BsMatchTileProps = {
  match: Match
  onEdit?: (match: Match) => void
  onStart?: (match: Match) => void
} & JSX.HTMLAttributes<HTMLDivElement>

export type BsMatchTypeProps = {
  type?: MatchType
  size?: DaisySize
} & JSX.HTMLAttributes<HTMLSpanElement>
