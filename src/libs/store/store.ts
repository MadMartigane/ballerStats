import type { PlayerRawData } from '../player'
import type { TeamRawData } from '../team'
import type { MatchRawData } from '../match'
import { StoredData } from './store.d'

const STORAGE_PLAYERS_KEY = 'BS_PLAYERS'
const STORAGE_TEAMS_KEY = 'BS_TEAMS'
const STORAGE_MATCHS_KEY = 'BS_MATCHS'

export async function storePlayers(
  players: Array<PlayerRawData>,
  lastRecord?: number | null,
) {
  const promise: Promise<void> = new Promise(resolve => {
    localStorage.setItem(
      STORAGE_PLAYERS_KEY,
      JSON.stringify({
        lastRecord: lastRecord || Date.now(),
        data: players,
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

export async function storeMatchs(
  matchs: Array<MatchRawData>,
  lastRecord?: number | null,
) {
  const promise: Promise<void> = new Promise(resolve => {
    localStorage.setItem(
      STORAGE_MATCHS_KEY,
      JSON.stringify({
        lastRecord: lastRecord || Date.now(),
        data: matchs,
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

export async function getStoredMatchs(): Promise<StoredData<MatchRawData> | null> {
  const promise: Promise<StoredData<MatchRawData> | null> = new Promise(
    resolve => {
      const stringMatchs = localStorage.getItem(STORAGE_MATCHS_KEY)
      if (!stringMatchs) {
        resolve(null)
        return
      }

      const storedMatchs: StoredData<MatchRawData> = JSON.parse(stringMatchs)
      resolve(storedMatchs)
    },
  )

  return promise
}
