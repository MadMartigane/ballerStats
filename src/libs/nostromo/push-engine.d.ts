/**
 * Public types of the push engine (`./push-engine.ts`).
 *
 * One document per unit: the six collections and, for each player, one photo
 * document whose id is derived from the player id alone. Every payload carries
 * a `schema` so a reader can refuse an envelope it does not know.
 */
import type { NostromoUnitName } from './nostromo-sync-store.d'

/**
 * Envelope of a collection document payload: `items` holds the full cloned
 * collection at push time (one entry for the single-object `trombiTitles`).
 */
export interface NostromoCollectionPayload {
  items: unknown[]
  name: NostromoUnitName
  schema: number
  type: 'collection'
}

/** Envelope of a photo document payload: the file itself travels as document file. */
export interface NostromoPhotoPayload {
  playerId: string
  schema: number
  type: 'photo'
}

/**
 * What one unit push ended with. The flush aggregates these: `auth` aborts the
 * whole run, `conflict` parks the unit until the conflict is resolved, `error`
 * leaves the unit queued and moves on to the next one.
 */
export type NostromoPushOutcome = 'auth' | 'conflict' | 'error' | 'ok'

/** A unit the engine can push: one collection name, or `photo:<playerId>`. */
export type NostromoPushUnit = NostromoUnitName | `photo:${string}`
