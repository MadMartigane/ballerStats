import type { BsEventBusType } from '../event-bus/event-bus.d'
import type { SyncCollection } from './sync.d'

/** Push order: players first (contacts/matchs depend on them), then teams, then matchs, then contacts. */
export const SYNC_COLLECTIONS: readonly SyncCollection[] = ['players', 'teams', 'matchs', 'contacts']

export const COLLECTION_CHANGE_EVENT: Record<SyncCollection, BsEventBusType> = {
  contacts: 'BS::CONTACTS::CHANGE',
  matchs: 'BS::MATCHS::CHANGE',
  players: 'BS::PLAYERS::CHANGE',
  teams: 'BS::TEAMS::CHANGE',
}
