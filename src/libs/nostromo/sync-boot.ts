/**
 * Boot of the Nostromo synchronization, called exactly once by the app entry
 * point (`src/index.tsx`) before the first render.
 *
 * The boot is explicit on purpose: the persisted sync state is read here, the
 * status the app starts with is derived from it, and the retry timers of the
 * push engine are installed at the same moment. Without this call the stores
 * would still hydrate lazily on their first read (same persisted data, later),
 * but the status chip would show `off` until something touched the store.
 */
import { isConfigured } from './nostromo-config-store'
import { getConflictedUnits, getDirtyUnits, pushNostromoLog, setNostromoSyncStatus } from './nostromo-sync-store'
import type { NostromoStatus } from './nostromo-sync-store.d'
import { startNostromoAutoSync } from './push-engine'

/** Idempotent guard: a second call is a no-op (hot reload, double import). */
let booted = false

/**
 * Hydrates the sync state, sets the status the app starts with, and installs the
 * auto-sync retries:
 *
 * - `off` when no backend is configured: the local app works, nothing is queued
 *   for a server,
 * - `conflict` when a unit was parked by a conflict before the reload, the only
 *   state the user must resolve by hand,
 * - `pending` when changes were queued before the last reload,
 * - `saved` when a configuration exists and the outbox is empty.
 */
export function startNostromoSyncBoot(): void {
  if (booted) {
    return
  }
  booted = true

  // Reading the outbox through the store performs the one and only hydration of
  // the persisted sync state, which loads both the baselines and the queued
  // units. `hydrateNostromoSync()` called with no argument would reset both to
  // empty instead, silently dropping every change queued before the reload.
  const pendingUnits = getDirtyUnits()

  setNostromoSyncStatus(deriveBootStatus(pendingUnits))
  if (isConfigured() && pendingUnits.length > 0) {
    pushNostromoLog('info', `Des changements locaux attendent d'être synchronisés (${pendingUnits.length}).`)
  }

  startNostromoAutoSync()
}

/** Status the app starts with, from what survived the last reload. */
function deriveBootStatus(pendingUnits: readonly string[]): NostromoStatus {
  if (!isConfigured()) {
    return 'off'
  }
  if (getConflictedUnits().length > 0) {
    return 'conflict'
  }
  return pendingUnits.length > 0 ? 'pending' : 'saved'
}
