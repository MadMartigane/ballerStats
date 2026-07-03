import type { ContactRawData } from '../contact'
import type { MatchRawData } from '../match'
import type { PlayerRawData } from '../player'
import type { TeamRawData } from '../team'
import type { StoredItemData } from './store.d'

export const STORAGE_PLAYERS_KEY = 'BS_PLAYERS'
export const STORAGE_TEAMS_KEY = 'BS_TEAMS'
export const STORAGE_MATCHS_KEY = 'BS_MATCHS'
export const STORAGE_TROMBI_TITLES_KEY = 'BS_TROMBI_TITLES'
export const STORAGE_CONTACTS_KEY = 'BS_CONTACTS'

export function storeData<T>(key: string, data: T, lastRecord?: number | null): Promise<void> {
  return new Promise((resolve) => {
    localStorage.setItem(key, JSON.stringify({ lastRecord: lastRecord || Date.now(), data }))
    resolve()
  })
}

export function getStoredData<T>(key: string): Promise<StoredItemData<T> | null> {
  return new Promise((resolve) => {
    const raw = localStorage.getItem(key)
    if (!raw) {
      resolve(null)
      return
    }
    resolve(JSON.parse(raw) as StoredItemData<T>)
  })
}

export function getStoredDataSync<T>(key: string): StoredItemData<T> | null {
  const raw = localStorage.getItem(key)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as StoredItemData<T>
  } catch {
    return null
  }
}

export function storePlayers(players: PlayerRawData[], lastRecord?: number | null): Promise<void> {
  return storeData(STORAGE_PLAYERS_KEY, players, lastRecord)
}

export function storeTeams(teams: TeamRawData[], lastRecord?: number | null): Promise<void> {
  return storeData(STORAGE_TEAMS_KEY, teams, lastRecord)
}

export function storeMatchs(matchs: MatchRawData[], lastRecord?: number | null): Promise<void> {
  return storeData(STORAGE_MATCHS_KEY, matchs, lastRecord)
}

export function getStoredPlayers(): Promise<StoredItemData<PlayerRawData[]> | null> {
  return getStoredData<PlayerRawData[]>(STORAGE_PLAYERS_KEY)
}

export function getStoredTeams(): Promise<StoredItemData<TeamRawData[]> | null> {
  return getStoredData<TeamRawData[]>(STORAGE_TEAMS_KEY)
}

export function getStoredMatchs(): Promise<StoredItemData<MatchRawData[]> | null> {
  return getStoredData<MatchRawData[]>(STORAGE_MATCHS_KEY)
}

export function storeContacts(contacts: ContactRawData[], lastRecord?: number | null): Promise<void> {
  return storeData(STORAGE_CONTACTS_KEY, contacts, lastRecord)
}

export function getStoredContacts(): Promise<StoredItemData<ContactRawData[]> | null> {
  return getStoredData<ContactRawData[]>(STORAGE_CONTACTS_KEY)
}
