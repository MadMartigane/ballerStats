import { type JSX } from 'solid-js'
import Player from '../../libs/player'

export type BsPlayerProps = {
  player: Player,
  onEdit: (player: Player) => void,
} & JSX.HTMLAttributes<HTMLDivElement>
