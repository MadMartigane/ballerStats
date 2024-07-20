import Team from '../../libs/team'
import { JSX } from 'solid-js'

export type BsTeamProps = {
  team: Team
  onEdit: (team: Team) => void,
} & JSX.HTMLAttributes<HTMLDivElement>
