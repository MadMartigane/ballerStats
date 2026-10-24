/**
 * Public types of the auth session (`./auth-session.ts`).
 *
 * `valid`: the stored token is usable (or its state is unknown, the server decides).
 * `refreshed`: the token was renewed and persisted during this call.
 * `expired`: the session is over, the user must sign in again.
 * `unconfigured`: no Nostromo session is stored.
 */
export type SessionHealth = 'valid' | 'refreshed' | 'expired' | 'unconfigured'
