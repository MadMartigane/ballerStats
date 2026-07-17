import Team from '../../team'
import type { TeamRawData } from '../../team/team.d'
import { nextId } from '../mock-counter'

const ID_PREFIX = 'mock-team'

/** Build a deterministic Team. Defaults satisfy isRegisterable (name set). */
export function makeTeam(overrides: Partial<TeamRawData> = {}): Team {
  const raw: TeamRawData = {
    name: 'Mock Team',
    playerIds: [],
    ...overrides,
    id: overrides.id ?? nextId(ID_PREFIX),
  }
  return new Team(raw)
}
