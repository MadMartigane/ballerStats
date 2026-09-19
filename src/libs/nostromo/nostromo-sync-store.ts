import { createStore } from 'solid-js/store'

import { getStoredDataSync, storeData } from '../store/store'
import type {
  NostromoBaseline,
  NostromoBaselines,
  NostromoBaselineUpdate,
  NostromoLogEntry,
  NostromoLogLevel,
  NostromoStatus,
  NostromoSyncPersistedState,
  NostromoSyncState,
} from './nostromo-sync-store.d'

export const STORAGE_NOSTROMO_BASELINES_KEY = 'BS_NOSTROMO_BASELINES'
export const STORAGE_NOSTROMO_OUTBOX_KEY = 'BS_NOSTROMO_OUTBOX'

/** The in-memory log is a bounded ring: past this length the oldest entry is dropped. */
export const NOSTROMO_LOG_LIMIT = 50

const [nostromoSync, setNostromoSync] = createStore<NostromoSyncState>({
  baselines: {},
  log: [],
  outbox: [],
  status: 'off',
})

export { nostromoSync }

/**
 * Marks of each unit, bumped by every `markUnitDirty` call. In memory only: a
 * revision compares two marks of the same session, so it needs no persistence.
 */
const dirtyRevisions = new Map<string, number>()

/**
 * Baselines (`BS_NOSTROMO_BASELINES`) and outbox (`BS_NOSTROMO_OUTBOX`) are
 * persisted with the same `{ data, lastRecord }` envelope as the collection
 * stores. They are hydrated lazily on the first read, or explicitly by the boot
 * module through `hydrateNostromoSync`. Status and log live in memory only.
 */
let hydrated = false

function cloneBaseline(baseline: NostromoBaseline): NostromoBaseline {
  const clone: NostromoBaseline = { docId: baseline.docId, savedAt: baseline.savedAt, version: baseline.version }
  if (baseline.conflicted) {
    clone.conflicted = true
  }
  return clone
}

function cloneBaselines(baselines: NostromoBaselines): NostromoBaselines {
  const clone: NostromoBaselines = {}
  for (const [unit, baseline] of Object.entries(baselines)) {
    if (baseline) {
      clone[unit] = cloneBaseline(baseline)
    }
  }
  return clone
}

/** Keeps the first occurrence of each non-empty string: the outbox holds at most one entry per unit. */
function sanitizeUnits(units: readonly unknown[]): string[] {
  const seen = new Set<string>()
  const sanitized: string[] = []
  for (const unit of units) {
    if (typeof unit !== 'string' || unit === '' || seen.has(unit)) {
      continue
    }
    seen.add(unit)
    sanitized.push(unit)
  }
  return sanitized
}

function loadPersistedState(): NostromoSyncPersistedState {
  const storedBaselines = getStoredDataSync<NostromoBaselines>(STORAGE_NOSTROMO_BASELINES_KEY)?.data
  const storedOutbox = getStoredDataSync<string[]>(STORAGE_NOSTROMO_OUTBOX_KEY)?.data
  return {
    baselines: storedBaselines && typeof storedBaselines === 'object' ? storedBaselines : {},
    outbox: Array.isArray(storedOutbox) ? storedOutbox : [],
  }
}

function ensureHydrated(): void {
  if (hydrated) {
    return
  }
  hydrated = true
  hydrateNostromoSync(loadPersistedState())
}

/**
 * Loads or imports the persisted sync state (baselines + outbox) without EVER
 * persisting, and resets the in-memory status and log. Called once at boot by
 * the app entry point; without that call the state hydrates on the first read.
 * Pass no argument to reset to an empty state (tests, sign-out).
 */
export function hydrateNostromoSync(state: NostromoSyncPersistedState = { baselines: {}, outbox: [] }): void {
  hydrated = true
  dirtyRevisions.clear()
  setNostromoSync({
    baselines: cloneBaselines(state.baselines),
    log: [],
    outbox: sanitizeUnits(state.outbox),
    status: 'off',
  })
}

/**
 * Forgets everything an account queued or learned: baselines (and the conflict
 * they park), outbox and mark revisions, then persists the empty state once.
 *
 * Called on sign-out, right after `clearConfig()`: document ids are derived from
 * the unit names alone and are therefore account-independent, so a second
 * account on the same device would inherit baselines describing documents it
 * does not own (400 on create, 404 on read) and could never push.
 */
export function resetNostromoSyncData(): void {
  ensureHydrated()
  dirtyRevisions.clear()
  setNostromoSync({ baselines: {}, log: getNostromoLog(), outbox: [], status: 'off' })
  persistBaselines()
  persistOutbox()
}

export function getNostromoSyncStatus(): NostromoStatus {
  ensureHydrated()
  return nostromoSync.status
}

/** Updates the in-memory sync status. Status is never persisted. */
export function setNostromoSyncStatus(status: NostromoStatus): void {
  ensureHydrated()
  setNostromoSync('status', status)
}

/** Appends an entry to the bounded in-memory log: never persisted, oldest entries drop first. */
export function pushNostromoLog(level: NostromoLogLevel, message: string): void {
  ensureHydrated()
  const next = [...getNostromoLog(), { at: Date.now(), level, message }]
  setNostromoSync('log', next.slice(-NOSTROMO_LOG_LIMIT))
}

export function getNostromoLog(): NostromoLogEntry[] {
  ensureHydrated()
  return nostromoSync.log.map((entry) => ({ at: entry.at, level: entry.level, message: entry.message }))
}

export function getBaseline(unit: string): NostromoBaseline | undefined {
  ensureHydrated()
  const baseline = nostromoSync.baselines[unit]
  return baseline ? cloneBaseline(baseline) : undefined
}

/**
 * Replaces the whole baselines map and persists exactly once. The assignment goes
 * through the root setter on purpose: a path setter (`setNostromoSync('baselines',
 * next)`) merges nested plain objects in Solid, which would keep a cleared unit alive.
 */
function replaceBaselines(next: NostromoBaselines): void {
  setNostromoSync({ baselines: next })
  persistBaselines()
}

/** Stores the last known server state of a unit and persists the baselines exactly once. */
export function setBaseline(unit: string, baseline: NostromoBaseline): void {
  ensureHydrated()
  const next = getAllBaselines()
  next[unit] = cloneBaseline(baseline)
  replaceBaselines(next)
}

/**
 * Stores several unit baselines in ONE grouped write: the `next` map is computed
 * purely, then persisted exactly once. Used by a restore run, which settles every
 * unit it applied at the end and must not write the storage once per unit.
 */
export function setBaselines(updates: readonly NostromoBaselineUpdate[]): void {
  ensureHydrated()
  const next = getAllBaselines()
  for (const { baseline, unit } of updates) {
    next[unit] = cloneBaseline(baseline)
  }
  replaceBaselines(next)
}

/** Forgets a unit baseline and persists once. Clearing an unknown unit is a no-op: no write. */
export function clearBaseline(unit: string): void {
  ensureHydrated()
  const next = getAllBaselines()
  if (!next[unit]) {
    return
  }
  delete next[unit]
  replaceBaselines(next)
}

/** Returns a clone of every baseline, keyed by unit. */
export function getAllBaselines(): NostromoBaselines {
  ensureHydrated()
  return cloneBaselines(nostromoSync.baselines)
}

/**
 * Units parked by a conflict, in baseline order. The parking is the
 * `conflicted` flag of the baseline, which is persisted: a reload reads the
 * same list back and the engine keeps skipping those units.
 */
export function getConflictedUnits(): string[] {
  ensureHydrated()
  return Object.entries(nostromoSync.baselines)
    .filter(([, baseline]) => baseline?.conflicted === true)
    .map(([unit]) => unit)
}

export function isUnitDirty(unit: string): boolean {
  ensureHydrated()
  return nostromoSync.outbox.includes(unit)
}

/** Revision of the last local mark of a unit: 0 when the unit was never marked in this session. */
export function getDirtyRevision(unit: string): number {
  ensureHydrated()
  return dirtyRevisions.get(unit) ?? 0
}

/**
 * Queues a unit for push and bumps its revision. An already queued unit is not
 * queued twice (no duplicate, no extra write), but its revision still moves:
 * that is what tells a push in flight that the content it is sending is already
 * stale (see `clearUnitDirtyIfUnchanged`).
 */
export function markUnitDirty(unit: string): void {
  ensureHydrated()
  dirtyRevisions.set(unit, getDirtyRevision(unit) + 1)
  if (isUnitDirty(unit)) {
    return
  }
  setDirtyUnits([...getDirtyUnits(), unit])
}

/** Removes a unit from the outbox and persists once. An unknown unit is a no-op: no write. */
export function clearUnitDirty(unit: string): void {
  ensureHydrated()
  if (!isUnitDirty(unit)) {
    return
  }
  setDirtyUnits(getDirtyUnits().filter((candidate) => candidate !== unit))
}

/**
 * Clears a unit only when no further local change was marked since `revision`
 * was read. Returns whether the unit was cleared: `false` means it changed while
 * its push was in flight, so the content that was just sent is already stale and
 * the unit must stay queued.
 */
export function clearUnitDirtyIfUnchanged(unit: string, revision: number): boolean {
  ensureHydrated()
  if (getDirtyRevision(unit) !== revision) {
    return false
  }
  clearUnitDirty(unit)
  return true
}

/** Returns a clone of the dirty units, in push order. */
export function getDirtyUnits(): string[] {
  ensureHydrated()
  return [...nostromoSync.outbox]
}

/** Replaces the whole outbox and persists exactly once (push engine drain, boot hydration). */
export function setDirtyUnits(units: string[]): void {
  ensureHydrated()
  setNostromoSync('outbox', sanitizeUnits(units))
  persistOutbox()
}

function persistBaselines(): void {
  storeData(STORAGE_NOSTROMO_BASELINES_KEY, getAllBaselines()).catch((error: unknown) => {
    console.error('storeData(Nostromo baselines) failed:', error)
  })
}

function persistOutbox(): void {
  storeData(STORAGE_NOSTROMO_OUTBOX_KEY, getDirtyUnits()).catch((error: unknown) => {
    console.error('storeData(Nostromo outbox) failed:', error)
  })
}
