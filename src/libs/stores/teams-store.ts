import { createStore, reconcile } from 'solid-js/store'
import { storeTeams } from '../store/store'
import type { TeamRawData } from '../team/team.d'

export function assertTeamAddable(existingTeams: TeamRawData[], newTeam: TeamRawData): void {
  if (!newTeam.name) {
    throw new Error('[Teams.add()] Team is not registerable (missing required data).')
  }
  const alreadyRegistered = existingTeams.some((current) => current.id === newTeam.id)
  if (alreadyRegistered) {
    throw new Error(`[Teams.add()] The team id ${newTeam.id} already exists.`)
  }
}

export function assertTeamExists(existingTeams: TeamRawData[], teamOrId: TeamRawData | string): TeamRawData {
  const id = typeof teamOrId === 'string' ? teamOrId : teamOrId.id
  const team = existingTeams.find((candidate) => candidate.id === id)
  if (!team) {
    throw new Error(`[Teams] The team id ${id} doesn't exist.`)
  }
  return team
}

const [teams, setTeams] = createStore<TeamRawData[]>([])

export { teams }

/** Single clone boundary for a team raw: shallow spread + deep-clone of the
 *  nested `matchFormat` and `playerIds`. Every read and write path routes through
 *  it so a caller can never keep a live reference to store-owned nested state. */
function cloneTeamRaw(raw: TeamRawData): TeamRawData {
  return {
    ...raw,
    matchFormat: raw.matchFormat ? { ...raw.matchFormat } : raw.matchFormat,
    playerIds: raw.playerIds ? [...raw.playerIds] : raw.playerIds,
  }
}

export function getRawTeams(): TeamRawData[] {
  return teams.map((raw) => cloneTeamRaw(raw))
}

export function getTeamById(id: string): TeamRawData | null {
  const raw = teams.find((candidate) => candidate.id === id)
  return raw ? cloneTeamRaw(raw) : null
}

function cloneRaws(raws: TeamRawData[]): TeamRawData[] {
  return raws.map((raw) => cloneTeamRaw(raw))
}

function persistTeams(): void {
  storeTeams(getRawTeams()).catch((error: unknown) => {
    console.error('storeTeams failed:', error)
  })
}

/**
 * Load or import a full collection: reconciles the reactive contents without
 * ever persisting. Persistence stays the explicit job of the mutations below.
 */
export function hydrateTeams(raws: TeamRawData[]): void {
  setTeams(reconcile(cloneRaws(raws), { key: 'id' }))
}

/** Replace the whole collection and persist exactly once (imports, demo seed, big clean). */
export function replaceAllTeams(raws: TeamRawData[]): void {
  setTeams(reconcile(cloneRaws(raws), { key: 'id' }))
  persistTeams()
}

export function addTeam(raw: TeamRawData): void {
  const next = getRawTeams()
  assertTeamAddable(next, raw)
  setTeams([...next, cloneTeamRaw(raw)])
  persistTeams()
}

export function updateTeam(id: string, raw: TeamRawData): void {
  assertTeamExists(teams, id)
  const index = teams.findIndex((candidate) => candidate.id === id)
  setTeams(index, cloneTeamRaw(raw))
  persistTeams()
}

export function removeTeam(teamOrId: TeamRawData | string): void {
  assertTeamExists(teams, teamOrId)
  const id = typeof teamOrId === 'string' ? teamOrId : teamOrId.id
  setTeams((current) => current.filter((candidate) => candidate.id !== id))
  persistTeams()
}
