import { PlayerRawData } from '../player'
import { StoredPlayers } from './store.d'

const STORAGE_PLAYERS_KEY = 'BS_PLAYERS'

export async function storePlayers(players: Array<PlayerRawData>) {
  const promise: Promise<void> = new Promise(resolve => {
    localStorage.setItem(
      STORAGE_PLAYERS_KEY,
      JSON.stringify({
        lastRecord: Date.now(),
        players: players,
      }),
    )
    resolve()
  })

  return promise
}

export async function getStoredPlayers(): Promise<StoredPlayers | null> {
  const promise: Promise<StoredPlayers | null> = new Promise(resolve => {
    const stringPlayer = localStorage.getItem(STORAGE_PLAYERS_KEY)
    if (!stringPlayer) {
      resolve(null)
      return
    }

    const storedPlayers: StoredPlayers = JSON.parse(stringPlayer)
    resolve(storedPlayers)
  })

  return promise
}
