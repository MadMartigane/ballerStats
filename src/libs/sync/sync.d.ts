import type { ContactRawData } from '../contact/contact.d'
import type { MatchRawData } from '../match/match.d'
import type { PlayerRawData } from '../player/player.d'
import type { TeamRawData } from '../team/team.d'

/** Collections synced per record with PocketBase. */
export type SyncCollection = 'players' | 'teams' | 'matchs' | 'contacts'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error' | 'conflict'

/**
 * Pending local mutation queued for the next push. The server payload is
 * rebuilt at push time from the live record so foreign keys always use the
 * freshest id map.
 */
export interface OutboxItem {
  attempts: number
  collection: SyncCollection
  createdAt: number
  /** Local record id (may be a legacy numeric-string id). */
  id: string
  photoPending?: boolean
  updatedAt: number
}

/** Last-synced local record state, keyed by record id — the diff baseline. */
export interface SyncSnapshot {
  contacts: Record<string, ContactRawData>
  matchs: Record<string, MatchRawData>
  players: Record<string, PlayerRawData>
  teams: Record<string, TeamRawData>
}

/** localId -> PocketBase record id, persisted across sessions. */
export interface IdMap {
  contacts: Record<string, string>
  matchs: Record<string, string>
  players: Record<string, string>
  teams: Record<string, string>
}

/** Remote record shape as returned by the PocketBase SDK. */
export interface RemoteRecord {
  id: string
  [key: string]: unknown
}

export interface SyncMeta {
  firstSyncResolved: boolean
  idMap: IdMap
  lastPullAt: Partial<Record<SyncCollection, number>>
  snapshot: SyncSnapshot
}

export type FirstSyncDecision = 'push-local' | 'pull-remote' | 'ask' | 'idle'

/** localId -> pbId re-key requests applied by the orchestrator. */
export interface IdentityRewrites {
  contacts?: Record<string, string>
  matchs?: Record<string, string>
  players?: Record<string, string>
  teams?: Record<string, string>
}
