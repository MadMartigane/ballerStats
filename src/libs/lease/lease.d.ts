/** Perspective of the current user on a match scoring lease. */
export type LeaseStateForMe = 'mine' | 'taken-by-other' | 'free' | 'expired'

/** The lease fields as stored on the `matchs` record. */
export interface MatchLeaseFields {
  scorer: string | null
  scorerLockUntil: string | null
}

/** Body returned by `POST /api/baller/matchs/{id}/acquire`. */
export interface LeaseAcquireResult extends MatchLeaseFields {
  expiresInSeconds: number
}

/** Identity of the current lease holder (resolved server-side). */
export interface LeaseHolder {
  email?: string | null
  id: string
  name?: string | null
}

export interface AcquireMatchLeaseOptions {
  force?: boolean
}
