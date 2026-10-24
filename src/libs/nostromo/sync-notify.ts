/**
 * Non-blocking toast for background sync failures, so a user who never opens the
 * Administration page still learns that their data is not leaving the device.
 *
 * Each kind is deduplicated over `NOTIFY_DEDUPE_MS`: the 60 s retry loop can fail
 * indefinitely without spamming. Offline failures never come here, the chip
 * showing `pending` is the whole signal.
 */
import { toast } from '../utils/utils'
import type { NostromoStatus } from './nostromo-sync-store.d'

export type SyncFailureKind = 'error' | 'auth' | 'conflict' | 'idb'

/** Minimum delay between two toasts of the same kind. */
export const NOTIFY_DEDUPE_MS = 5 * 60_000

const FAILURE_MESSAGES: Record<SyncFailureKind, string> = {
  auth: 'Session expirée : reconnectez-vous à Nostromo.',
  conflict: 'Conflit de synchronisation à résoudre.',
  error: 'La synchronisation a échoué. Vos données restent sur cet appareil et seront renvoyées.',
  idb: "Le stockage local du navigateur est indisponible : les modifications risquent d'être perdues.",
}

const lastNotifiedAt = new Map<SyncFailureKind, number>()

/** Toasts the failure of `kind` unless the same kind was toasted less than `NOTIFY_DEDUPE_MS` ago. */
export function notifySyncFailure(kind: SyncFailureKind, detail?: string): void {
  const now = Date.now()
  const previous = lastNotifiedAt.get(kind)
  if (previous !== undefined && now - previous < NOTIFY_DEDUPE_MS) {
    return
  }
  lastNotifiedAt.set(kind, now)
  toast(detail ? `${FAILURE_MESSAGES[kind]} ${detail}` : FAILURE_MESSAGES[kind], 'error')
}

/** Notifies the status a run settled on when it is a failure: `error`, `conflict` or `auth-required`. */
export function notifySyncFailureStatus(status: NostromoStatus): void {
  if (status === 'error' || status === 'conflict') {
    notifySyncFailure(status)
  } else if (status === 'auth-required') {
    notifySyncFailure('auth')
  }
}

/** Forgets every dedupe window: tests only. */
export function resetSyncNotifyForTests(): void {
  lastNotifiedAt.clear()
}
