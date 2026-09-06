import { createStore, reconcile } from 'solid-js/store'
import type { MatchRawData } from '../match/match.d'
import { storeMatchs } from '../store/store'

export function assertMatchAddable(existingMatchs: MatchRawData[], newMatch: MatchRawData): void {
  if (!newMatch.opponent || !newMatch.type || !newMatch.teamId) {
    throw new Error(`[Matchs.add()] The match id ${newMatch.id ?? ''} is not registerable, Please complete the data.`)
  }
  const alreadyRegistered = existingMatchs.some((current) => current.id === newMatch.id)
  if (alreadyRegistered) {
    throw new Error(
      `[Matchs.add()] The match id ${newMatch.id} already exists, Please use .updateMatch() method instead.`
    )
  }
}

export function assertMatchExists(existingMatchs: MatchRawData[], matchOrId: MatchRawData | string): MatchRawData {
  const id = typeof matchOrId === 'string' ? matchOrId : matchOrId.id
  const match = existingMatchs.find((candidate) => candidate.id === id)
  if (!match) {
    throw new Error(`[Matchs] The match id ${id} doesn't exist, Please use .add() method instead.`)
  }
  return match
}

const [matchs, setMatchs] = createStore<MatchRawData[]>([])

export { matchs }

export function getRawMatchs(): MatchRawData[] {
  return matchs.map((raw) => cloneMatchRaw(raw))
}

export function getMatchById(id: string): MatchRawData | null {
  const raw = matchs.find((candidate) => candidate.id === id)
  return raw ? cloneMatchRaw(raw) : null
}

function cloneMatchRaw(raw: MatchRawData): MatchRawData {
  return {
    ...raw,
    playersInTheFive: [...(raw.playersInTheFive ?? [])],
    stats: (raw.stats ?? []).map((stat) => ({ ...stat })),
  }
}

function cloneRaws(raws: MatchRawData[]): MatchRawData[] {
  return raws.map((raw) => cloneMatchRaw(raw))
}

function persistMatchs(): void {
  storeMatchs(getRawMatchs()).catch((error: unknown) => {
    console.error('storeMatchs failed:', error)
  })
}

/** Load or import a full collection: reconciles the reactive contents without ever persisting. */
export function hydrateMatchs(raws: MatchRawData[]): void {
  setMatchs(reconcile(cloneRaws(raws), { key: 'id' }))
}

/** Replace the whole collection and persist exactly once (imports, demo seed, big clean). */
export function replaceAllMatchs(raws: MatchRawData[]): void {
  setMatchs(reconcile(cloneRaws(raws), { key: 'id' }))
  persistMatchs()
}

export function addMatch(raw: MatchRawData): void {
  const next = getRawMatchs()
  assertMatchAddable(next, raw)
  setMatchs([...next, cloneMatchRaw(raw)])
  persistMatchs()
}

export function updateMatch(id: string, raw: MatchRawData): void {
  assertMatchExists(matchs, id)
  const index = matchs.findIndex((candidate) => candidate.id === id)
  setMatchs(index, cloneMatchRaw(raw))
  persistMatchs()
}

export function removeMatch(matchOrId: MatchRawData | string): void {
  assertMatchExists(matchs, matchOrId)
  const id = typeof matchOrId === 'string' ? matchOrId : matchOrId.id
  setMatchs((current) => current.filter((candidate) => candidate.id !== id))
  persistMatchs()
}
