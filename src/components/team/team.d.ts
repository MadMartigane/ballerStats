import type { JSX } from 'solid-js';
import type Team from '../../libs/team';

export type BsTeamProps = {
  team: Team;
  onEdit: (team: Team) => void;
} & JSX.HTMLAttributes<HTMLDivElement>;
