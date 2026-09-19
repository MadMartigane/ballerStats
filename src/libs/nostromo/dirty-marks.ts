/**
 * Cheap "this unit changed locally" markers, shared by every store mutation.
 *
 * This module is deliberately a leaf: the six collection stores and the photo
 * store import it, and it imports none of them. Hosting the marks in
 * `push-engine.ts` would close a cycle at module evaluation time
 * (push-engine → stores → push-engine), so they live here instead and
 * `push-engine.ts` re-exports them for its own callers.
 *
 * A mark never plans or awaits any work: it records the unit in the sync store
 * outbox and (re)arms one sliding debounce timer. When that timer expires it
 * calls the single runner registered by `push-engine.ts`; without a registered
 * runner nothing is pushed, and nothing is pushed at all while the app is not
 * configured (that state maps to the `off` status).
 */
import { isConfigured } from './nostromo-config-store'
import { markUnitDirty, setNostromoSyncStatus } from './nostromo-sync-store'
import type { NostromoUnitName } from './nostromo-sync-store.d'

/** Sliding debounce window: a burst of edits collapses into a single push. */
export const DIRTY_DEBOUNCE_MS = 10_000

/** Prefix of a photo unit key: the unit of a player's photo is `photo:<playerId>`. */
export const PHOTO_UNIT_PREFIX = 'photo:'

/** Unit key of a player's photo document. */
export function photoUnitName(playerId: string): string {
  return `${PHOTO_UNIT_PREFIX}${playerId}`
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined
let flushRunner: (() => void) | undefined

/**
 * Registers the flush to run when the debounce expires. `push-engine.ts` sets it
 * at module load; passing `undefined` detaches it.
 */
export function setDirtyFlushRunner(runner: (() => void) | undefined): void {
  flushRunner = runner
}

/** Disarms the pending debounce. A flush starting cancels it: no double push. */
export function cancelDirtyDebounce(): void {
  if (debounceTimer === undefined) {
    return
  }
  clearTimeout(debounceTimer)
  debounceTimer = undefined
}

/**
 * Restarts the sliding window: every mark pushes the next flush 10 seconds away.
 * Exported for the push engine: a unit that changed while its own push was in
 * flight stays queued and needs a follow-up flush it cannot schedule by marking
 * (the change is already marked).
 */
export function armDirtyDebounce(): void {
  cancelDirtyDebounce()
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined
    flushRunner?.()
  }, DIRTY_DEBOUNCE_MS)
}

/**
 * Queues a unit and schedules the push. Synchronous and throw-free by
 * construction: a store mutation must never fail because of the sync layer.
 * Without a configuration the unit is still queued (it will be pushed after
 * sign-in) but no timer is armed and no push is attempted: "not configured" and
 * "not synchronizing" are the same status, `off`.
 */
function markDirty(unit: string): void {
  markUnitDirty(unit)
  if (!isConfigured()) {
    setNostromoSyncStatus('off')
    return
  }
  setNostromoSyncStatus('pending')
  armDirtyDebounce()
}

/** Marks a collection unit as changed. Called by the collection store funnels. */
export function markCollectionDirty(unit: NostromoUnitName): void {
  markDirty(unit)
}

/** Marks a player's photo as changed. Called by the photo store writes. */
export function markPhotoDirty(playerId: string): void {
  if (playerId === '') {
    return
  }
  markDirty(photoUnitName(playerId))
}
