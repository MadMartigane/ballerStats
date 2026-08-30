import { pb } from '../pocketbase/client'
import type {
  AcquireMatchLeaseOptions,
  LeaseAcquireResult,
  LeaseHolder,
  LeaseStateForMe,
  MatchLeaseFields,
} from './lease.d'

/** Client heartbeat cadence; the server TTL is 45s, 15s keeps one cycle of margin. */
export const LEASE_HEARTBEAT_MS = 15_000

/** Whether a `scorerLockUntil` deadline is still in the future at `now`. */
export function isLeaseActive(scorerLockUntil: string | null, now: number): boolean {
  if (!scorerLockUntil) {
    return false
  }
  return new Date(scorerLockUntil).getTime() > now
}

/** Classifies a lease snapshot from the point of view of `myUserId`. */
export function leaseStateForMe(record: MatchLeaseFields, myUserId: string | null, now = Date.now()): LeaseStateForMe {
  if (!record.scorer) {
    return 'free'
  }
  if (!isLeaseActive(record.scorerLockUntil, now)) {
    return 'expired'
  }
  return record.scorer === myUserId ? 'mine' : 'taken-by-other'
}

/** Acquires (or renews) the scoring lease. `force` only works for owner/admin. */
export function acquireMatchLease(
  matchId: string,
  options: AcquireMatchLeaseOptions = {}
): Promise<LeaseAcquireResult> {
  return pb.send<LeaseAcquireResult>(`/api/baller/matchs/${matchId}/acquire`, {
    body: { force: options.force === true },
    method: 'POST',
  })
}

/** Renews the lease of the current user (the acquire route lets the holder through). */
export function heartbeatMatchLease(matchId: string): Promise<LeaseAcquireResult> {
  return acquireMatchLease(matchId)
}

/** Best-effort clear of the lease; allowed for any authenticated user. */
export async function releaseMatchLease(matchId: string): Promise<void> {
  await pb.send(`/api/baller/matchs/${matchId}/release`, { method: 'POST' })
}

interface LeaseErrorLike {
  data?: {
    data?: { holder?: LeaseHolder | null }
    holder?: LeaseHolder | null
  }
  status?: number
}

/** True when the server keeps the lease for an active other scorer (HTTP 409). */
export function isLeaseHeldError(err: unknown): boolean {
  return (err as LeaseErrorLike | undefined)?.status === 409
}

/** Reads the holder identity embedded in a 409 acquire rejection. */
export function getLeaseHolderFromError(err: unknown): LeaseHolder | null {
  const body = (err as LeaseErrorLike | undefined)?.data
  const holder = body?.data?.holder ?? body?.holder
  return holder ?? null
}
