/**
 * Public types of the pull engine (`./pull-engine.ts`).
 */

/** Why a pull did not even start comparing versions. */
export type NostromoPullSkipReason = 'unconfigured' | 'auth' | 'conflict-pending' | 'offline'

/** What one pull run ended with. */
export type PullOutcome =
  | { kind: 'applied'; units: string[] }
  | { kind: 'up-to-date' }
  | { kind: 'skipped'; reason: NostromoPullSkipReason }
  | { kind: 'error'; message: string }

/** Options of a pull run. `force` applies every remote collection, whatever its version. `respectBackoff` lets an automatic trigger skip the outbox drain while a push backoff runs; a user action leaves it unset. */
export interface NostromoPullOptions {
  force?: boolean
  respectBackoff?: boolean
}
