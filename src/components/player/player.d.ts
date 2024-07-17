import { type JSX } from 'solid-js'
import Player from '../../libs/player'

export type BsPlayerProps = {
  player: Player
} & JSX.HTMLAttributes<HTMLDivElement>
