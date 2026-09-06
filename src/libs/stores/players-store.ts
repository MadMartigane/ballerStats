/**
 * Reference pattern for collection stores (players, contacts, teams, matchs,
 * clubs). Detailed conventions in docs/state-architecture.md: hydrate never
 * persists, mutations = pure next[] + a single persist.
 */
import { createStore, reconcile } from 'solid-js/store'
import Player from '../player/player'
import type { PlayerRawData } from '../player/player.d'
import { storePlayers } from '../store/store'

export function assertPlayerAddable(existingPlayers: PlayerRawData[], newPlayer: PlayerRawData): void {
  if (!new Player(newPlayer).isRegisterable) {
    throw new Error('[Players.add()] Player is not registerable (missing required data).')
  }
  const alreadyRegistered = existingPlayers.some((current) => current.id === newPlayer.id)
  if (alreadyRegistered) {
    throw new Error(`[Players.add()] The player id ${newPlayer.id} already exists.`)
  }
}

const [players, setPlayers] = createStore<PlayerRawData[]>([])

export { players }

export function getRawPlayers(): PlayerRawData[] {
  return players.map((raw) => ({ ...raw }))
}

export function getPlayerById(id: string): PlayerRawData | null {
  const raw = players.find((candidate) => candidate.id === id)
  return raw ? { ...raw } : null
}

function cloneRaws(raws: PlayerRawData[]): PlayerRawData[] {
  return raws.map((raw) => ({ ...raw }))
}

function persistPlayers(): void {
  storePlayers(getRawPlayers()).catch((error: unknown) => {
    console.error('storePlayers failed:', error)
  })
}

/**
 * Load or import a full collection: reconciles the reactive contents without
 * ever persisting. Persistence stays the explicit job of the mutations below.
 */
export function hydratePlayers(raws: PlayerRawData[]): void {
  setPlayers(reconcile(cloneRaws(raws), { key: 'id' }))
}

/** Replace the whole collection and persist exactly once (imports, demo seed, big clean). */
export function replaceAllPlayers(raws: PlayerRawData[]): void {
  setPlayers(reconcile(cloneRaws(raws), { key: 'id' }))
  persistPlayers()
}

export function addPlayer(raw: PlayerRawData): void {
  const next = getRawPlayers()
  assertPlayerAddable(next, raw)
  setPlayers([...next, { ...raw }])
  persistPlayers()
}

export function updatePlayer(id: string, raw: PlayerRawData): void {
  const index = players.findIndex((candidate) => candidate.id === id)
  if (index === -1) {
    throw new Error(`[BsPlayers.updatePlayer()] The player id ${id} doesn't exist, Please use .add() method instead.`)
  }
  setPlayers(index, { ...raw })
  persistPlayers()
}

export function removePlayer(id: string): void {
  const index = players.findIndex((candidate) => candidate.id === id)
  if (index === -1) {
    throw new Error(`[BsPlayers.remove()] The player id ${id} not found, Unable to remove it.`)
  }
  setPlayers((current) => current.filter((candidate) => candidate.id !== id))
  persistPlayers()
}
