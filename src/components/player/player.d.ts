import type Player from '../../libs/player/player'

export interface BsPlayerProps {
  onEdit: (player: Player) => void
  player: Player
}
