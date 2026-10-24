/**
 * Listener wiring of the Nostromo synchronization: what makes the engines run
 * on their own.
 *
 * - an interval flushes the outbox (a failed unit gets another chance, within
 *   the backoff of the push engine),
 * - the tab becoming hidden flushes (the last moment before the browser freezes
 *   the page), the tab becoming visible pulls, throttled by `PULL_MIN_INTERVAL_MS`,
 * - the network coming back flushes then pulls, with no throttle and no backoff:
 *   it is a user-grade signal,
 * - the network going away is only logged.
 *
 * Lives apart from `push-engine.ts` so the pull engine can be wired without the
 * push engine importing it. The push engine re-exports the two entry points to
 * keep its public API.
 */
import { isConfigured } from './nostromo-config-store'
import { getDirtyUnits, getNostromoSyncStatus, pushNostromoLog } from './nostromo-sync-store'
import { pullNostromo } from './pull-engine'
import { flushNostromoPush, isPushBackoffActive, launchFlush, NOSTROMO_RETRY_INTERVAL_MS } from './push-engine'

/** Minimum delay between two pulls triggered by the tab becoming visible. */
export const PULL_MIN_INTERVAL_MS = 30_000

let retryTimer: ReturnType<typeof setInterval> | undefined
let lastVisiblePullAt = Number.NEGATIVE_INFINITY

/** Pushes only when there is something to push, a backend to push it to, and no backoff running. */
function flushWhenPending(): void {
  if (getDirtyUnits().length === 0 || !isConfigured() || isPushBackoffActive()) {
    return
  }
  launchFlush()
}

/** A pull on an expired session or on a parked conflict could only fail again. */
function isPullAllowed(): boolean {
  const status = getNostromoSyncStatus()
  return isConfigured() && status !== 'auth-required' && status !== 'conflict'
}

function pullInBackground(): void {
  pullNostromo({ respectBackoff: true }).catch((error: unknown) => {
    console.error('pullNostromo failed:', error)
  })
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    flushWhenPending()
    return
  }
  const now = Date.now()
  if (now - lastVisiblePullAt < PULL_MIN_INTERVAL_MS || !isPullAllowed()) {
    return
  }
  lastVisiblePullAt = now
  pullInBackground()
}

async function flushThenPull(): Promise<void> {
  await flushNostromoPush()
  if (isPullAllowed()) {
    lastVisiblePullAt = Date.now()
    await pullNostromo()
  }
}

function onOnline(): void {
  pushNostromoLog('info', 'Connexion rétablie : envoi puis reprise des données Nostromo.')
  flushThenPull().catch((error: unknown) => {
    console.error('flushThenPull failed:', error)
  })
}

function onOffline(): void {
  pushNostromoLog('info', 'Connexion perdue : les changements restent en attente.')
}

/** Installs every trigger. Idempotent: calling it twice installs nothing twice. */
export function startNostromoAutoSync(): void {
  if (retryTimer !== undefined) {
    return
  }
  retryTimer = setInterval(flushWhenPending, NOSTROMO_RETRY_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
}

/** Removes the interval and every listener (sign-out, tests). Safe when not started. */
export function stopNostromoAutoSync(): void {
  if (retryTimer !== undefined) {
    clearInterval(retryTimer)
    retryTimer = undefined
  }
  lastVisiblePullAt = Number.NEGATIVE_INFINITY
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
}
