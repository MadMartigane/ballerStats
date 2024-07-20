import { PlayerRawData } from '../player'
import { TeamRawData } from '../team'
import { StoredData } from './store.d'

const STORAGE_PLAYERS_KEY = 'BS_PLAYERS'
const STORAGE_TEAMS_KEY = 'BS_TEAMS'

export async function storePlayers(
  players: Array<PlayerRawData>,
  lastRecord?: number | null,
) {
  const promise: Promise<void> = new Promise(resolve => {
    localStorage.setItem(
      STORAGE_PLAYERS_KEY,
      JSON.stringify({
        lastRecord: lastRecord || Date.now(),
        players: players,
      }),
    )
    resolve()
  })

  return promise
}

export async function storeTeams(
  teams: Array<TeamRawData>,
  lastRecord?: number | null,
) {
  const promise: Promise<void> = new Promise(resolve => {
    localStorage.setItem(
      STORAGE_TEAMS_KEY,
      JSON.stringify({
        lastRecord: lastRecord || Date.now(),
        data: teams,
      }),
    )
    resolve()
  })

  return promise
}

export async function getStoredPlayers(): Promise<StoredData<PlayerRawData> | null> {
  const promise: Promise<StoredData<PlayerRawData> | null> = new Promise(
    resolve => {
      const stringPlayers = localStorage.getItem(STORAGE_PLAYERS_KEY)
      if (!stringPlayers) {
        resolve(null)
        return
      }

      const storedPlayers: StoredData<PlayerRawData> = JSON.parse(stringPlayers)
      resolve(storedPlayers)
    },
  )

  return promise
}

export async function getStoredTeams(): Promise<StoredData<TeamRawData> | null> {
  const promise: Promise<StoredData<TeamRawData> | null> = new Promise(
    resolve => {
      const stringTeams = localStorage.getItem(STORAGE_TEAMS_KEY)
      if (!stringTeams) {
        resolve(null)
        return
      }

      const storedTeams: StoredData<TeamRawData> = JSON.parse(stringTeams)
      resolve(storedTeams)
    },
  )

  return promise
}
