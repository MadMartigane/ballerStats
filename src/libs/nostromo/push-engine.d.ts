/**
 * Public types of the push engine (`./push-engine.ts`).
 *
 * One document per unit: the six collections and, for each player, one photo
 * document whose id is derived from the player id alone. Every payload carries
 * a `schema` so a reader can refuse an envelope it does not know.
 */

/**
 * What one unit push ended with. The flush aggregates these: `auth` aborts the
 * whole run, `conflict` parks the unit until the conflict is resolved, `error`
 * leaves the unit queued and moves on to the next one.
 */
export type NostromoPushOutcome = 'auth' | 'conflict' | 'error' | 'ok'
