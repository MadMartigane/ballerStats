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
import { createSignal } from 'solid-js'

import { toast } from '../utils/utils'
import { ensureFreshSession } from './auth-session'
import { startNostromoAutoSync } from './auto-sync'
import { resolveConflict } from './conflict-resolution'
import { isConfigured } from './nostromo-config-store'
import {
  getBaseline,
  getConflictedUnits,
  getDirtyUnits,
  pushNostromoLog,
  setNostromoSyncStatus,
} from './nostromo-sync-store'
import type { NostromoStatus } from './nostromo-sync-store.d'
import { pullNostromo } from './pull-engine'
import type { PullOutcome } from './pull-engine.d'
import { flushNostromoPush } from './push-engine'
import { isCollectionUnitName } from './units'

const PULL_APPLIED_MESSAGE = 'Données mises à jour depuis le serveur.'
const PHOTO_SKIPPED_MESSAGE = 'Les photos modifiées localement sont conservées et renvoyées au serveur.'

/** Units the open pull could not apply because they still hold unsent local changes. */
export interface NostromoPullDecision {
  units: string[]
}

const [openPullDecision, setOpenPullDecision] = createSignal<NostromoPullDecision | undefined>()
const [openPullBusy, setOpenPullBusy] = createSignal(false)

/** Pending decision of the open pull, or `undefined` when nothing is waiting for the user. */
export { openPullBusy, openPullDecision }

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

  if (isConfigured()) {
    // Fire-and-forget: the first render never waits for the network.
    pullOnOpen().catch(() => undefined)
  }
}

/** « Garder mes données »: closes the modal, the pending changes stay queued. */
export function keepLocalOnOpenPull(): void {
  setOpenPullDecision(undefined)
}

/**
 * Runs one modal handler while the modal stays mounted and disabled. When the
 * handler ends, only the decision it owned is cleared: a decision set during the
 * handler belongs to a newer run and is kept.
 */
async function runOpenPullHandler(
  owned: NostromoPullDecision | undefined,
  handler: () => Promise<void>
): Promise<void> {
  setOpenPullBusy(true)
  try {
    await handler()
  } finally {
    if (owned !== undefined && openPullDecision() === owned) {
      setOpenPullDecision(undefined)
    }
    setOpenPullBusy(false)
  }
}

/**
 * « Envoyer d'abord » : drains the outbox again, then pulls again. The new decision,
 * if any, is set by the pull itself, so this call owns none to clear.
 */
export function retryOpenPull(): Promise<void> {
  return runOpenPullHandler(undefined, async () => {
    await flushNostromoPush()
    await pullOnOpen()
  })
}

/**
 * « Prendre celles du serveur » : each collection unit is confirmed, then replaced by
 * the server copy. Photo units are not collections: they stay queued and are pushed.
 * A failing unit is logged and does not stop the next ones.
 */
export function takeServerOnOpenPull(): Promise<void> {
  const decision = openPullDecision()
  if (!decision) {
    return Promise.resolve()
  }
  return runOpenPullHandler(decision, async () => {
    const takeable = decision.units.filter(isTakeableUnit)
    if (takeable.length < decision.units.length) {
      pushNostromoLog('info', 'Les photos modifiées localement sont conservées et seront renvoyées.')
      toast(PHOTO_SKIPPED_MESSAGE, 'info')
    }
    for (const unit of takeable) {
      // biome-ignore lint/performance/noAwaitInLoops: one confirmation dialog per unit, strictly in turn
      await takeServerUnit(unit)
    }
  })
}

/** A unit the server copy can replace: a collection with a server reference (its document id). */
function isTakeableUnit(unit: string): boolean {
  return isCollectionUnitName(unit) && getBaseline(unit) !== undefined
}

async function takeServerUnit(unit: string): Promise<void> {
  try {
    await resolveConflict(unit, 'take-server')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    pushNostromoLog('error', `Impossible de prendre « ${unit} » depuis le serveur : ${message}`)
    toast(message, 'error')
  }
}

/**
 * Pull of the open path. Never throws: failures go to the log and the status.
 * Unsynced data left after the drain is never overwritten automatically.
 */
async function pullOnOpen(): Promise<void> {
  try {
    await ensureFreshSession()
    const outcome = await pullNostromo()
    if (outcome.kind === 'applied') {
      setOpenPullDecision(undefined)
      toast(PULL_APPLIED_MESSAGE, 'success')
      return
    }
    setOpenPullDecision(openPullDecisionFor(outcome))
  } catch (error) {
    setOpenPullDecision(undefined)
    pushNostromoLog('error', `Le pull à l'ouverture a échoué : ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * The modal decision of an outcome: only a conflict with unsynced units asks the user,
 * and only when online. Offline, the unsent data is expected and the retries handle it.
 */
function openPullDecisionFor(outcome: PullOutcome): NostromoPullDecision | undefined {
  if (outcome.kind !== 'skipped' || outcome.reason !== 'conflict-pending') {
    return undefined
  }
  const units = getDirtyUnits()
  return units.length > 0 && navigator.onLine ? { units } : undefined
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
