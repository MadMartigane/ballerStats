import type { JSX } from 'solid-js';
import type Player from '../../libs/player';

export type BsPlayerProps = {
  player: Player;
  onEdit: (player: Player) => void;
} & JSX.HTMLAttributes<HTMLDivElement>;
