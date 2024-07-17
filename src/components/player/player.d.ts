import { type JSX } from 'solid-js'
import Player from '../../libs/player'

export type PlayerElProps = {
  player: Player
} & JSX.HTMLAttributes<HTMLDivElement>
