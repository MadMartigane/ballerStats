/** Lifecycle of the Nostromo synchronization, displayed by the UI. */
export type NostromoStatus =
  | 'off'
  | 'unconfigured'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'error'
  | 'conflict'
  | 'auth-required'

export type NostromoLogLevel = 'info' | 'warn' | 'error'

/** One line of the bounded in-memory sync log. Never persisted. */
export interface NostromoLogEntry {
  /** Epoch milliseconds at which the entry was pushed. */
  at: number
  level: NostromoLogLevel
  message: string
}

/**
 * Collections synchronized one document per unit. Photo documents are not listed
 * here: their unit key is the `photo:<playerId>` template string. `trombiTitles`
 * is the single-object unit: its payload holds one title object instead of a
 * list of id-carrying entries, which is why the five list collections have their
 * own name type below.
 */
export type NostromoUnitName = 'players' | 'teams' | 'matchs' | 'contacts' | 'clubs' | 'trombiTitles'

/** The five list collections: every unit except the single-object `trombiTitles`. */
export type NostromoListUnitName = Exclude<NostromoUnitName, 'trombiTitles'>

/**
 * Last server state known for a synchronized unit.
 *
 * `version` is the mandatory conflict token (server-managed, incremented by one
 * per accepted write). `savedAt` is the local epoch milliseconds at which the
 * version was learned: display only, never a conflict token.
 *
 * `conflicted` parks the unit: the last push hit a 409 and must not overwrite
 * the server copy again until the conflict is resolved. It is persisted with the
 * rest of the baseline, so a reload does not lose the parking; an old baseline
 * persisted without the flag is a unit that is not parked.
 */
export interface NostromoBaseline {
  /** True while the unit waits for an explicit conflict resolution. */
  conflicted?: boolean
  /** Client-generated document id (15 lowercase alphanumeric characters). */
  docId: string
  savedAt: number
  version: number
}

/** Unit key → baseline. Keys are `NostromoUnitName` values or `photo:<playerId>`. */
export type NostromoBaselines = Record<string, NostromoBaseline | undefined>

/** Full reactive shape of the sync store. */
export interface NostromoSyncState {
  baselines: NostromoBaselines
  log: NostromoLogEntry[]
  outbox: string[]
  status: NostromoStatus
}

/** Part of the sync state that survives a page refresh. */
export interface NostromoSyncPersistedState {
  baselines: NostromoBaselines
  outbox: string[]
}
