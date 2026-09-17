/**
 * Document payloads of the Nostromo synchronization, shared by the push engine
 * and the restore.
 *
 * A payload is opaque to the server and owned by this app: every document
 * carries a `schema` so a reader can refuse an envelope it does not know. This
 * module holds the two halves of that contract, in one place for both the push
 * and the pull:
 *
 * - the envelope builders (`buildCollectionPayload`, `buildPhotoPayload`),
 * - the runtime guards (`readCollectionPayload`, `readPhotoPayload`), the only
 *   place where a remote payload becomes local data.
 *
 * The guards validate the envelope and the identity of every entry, never the
 * domain fields: those belong to the collections themselves. A payload this app
 * wrote always passes; anything else is refused with a reason instead of being
 * written into a store.
 */
import type { TrombiTitles } from '../trombi-titles'
import type { NostromoListUnitName, NostromoUnitName } from './nostromo-sync-store.d'
import type { NostromoCollectionPayload, NostromoPhotoPayload } from './push-engine.d'

/** Schema of every payload this app writes. Readers must refuse anything else. */
export const NOSTROMO_PAYLOAD_SCHEMA = 1

/**
 * One entry of a list payload, as proven by the guard: a plain object carrying a
 * non-empty string `id`. Extra fields are tolerated and preserved untouched, the
 * domain fields of a collection are never re-validated here.
 */
export interface NostromoCollectionItem {
  id: string
}

/** A payload that failed its guard: the reason is logged and the unit is skipped. */
export interface InvalidPayloadRead {
  kind: 'invalid'
  reason: string
}

/** What the guard proved about the entries of a list collection payload. */
export interface ValidItemsRead {
  items: NostromoCollectionItem[]
  kind: 'items'
  unit: NostromoListUnitName
}

/** What the guard proved about a `trombiTitles` payload: one title object, never a list. */
export interface ValidTitlesRead {
  kind: 'titles'
  titles: TrombiTitles
  unit: 'trombiTitles'
}

/** A collection payload this app can apply, list unit or single-object title unit. */
export type ValidCollectionRead = ValidItemsRead | ValidTitlesRead

/** Result of reading a collection payload, for any collection unit. */
export type CollectionPayloadRead = InvalidPayloadRead | ValidCollectionRead

/** What the guard proved about a photo payload: it names the player it belongs to. */
export interface ValidPhotoRead {
  kind: 'valid'
  playerId: string
}

export type PhotoPayloadRead = InvalidPayloadRead | ValidPhotoRead

/** Collection envelope of a unit: the full collection at call time. */
export function buildCollectionPayload(unit: NostromoUnitName, items: unknown[]): NostromoCollectionPayload {
  return { items, name: unit, schema: NOSTROMO_PAYLOAD_SCHEMA, type: 'collection' }
}

/** Photo envelope of a player: the image itself travels as the document file. */
export function buildPhotoPayload(playerId: string): NostromoPhotoPayload {
  return { playerId, schema: NOSTROMO_PAYLOAD_SCHEMA, type: 'photo' }
}

/**
 * Runtime guard of a collection payload: the envelope must be the one this app
 * writes (`{ schema, type: 'collection', name, items }`), the name must be the
 * unit being applied, and the entries must be the ones that unit describes: a
 * list of id-carrying objects for the five collections, one title object for
 * `trombiTitles`.
 */
export function readCollectionPayload(payload: unknown, unit: NostromoUnitName): CollectionPayloadRead {
  const record = toPayloadRecord(payload)
  if (!record) {
    return { kind: 'invalid', reason: "la charge utile n'est pas un objet" }
  }
  if (record.schema !== NOSTROMO_PAYLOAD_SCHEMA) {
    return { kind: 'invalid', reason: `le schéma de la charge utile n'est pas ${NOSTROMO_PAYLOAD_SCHEMA}` }
  }
  if (record.type !== 'collection' || record.name !== unit) {
    return { kind: 'invalid', reason: `la charge utile ne décrit pas la collection ${unit}` }
  }
  if (!Array.isArray(record.items)) {
    return { kind: 'invalid', reason: "items n'est pas une liste d'entrées de collection" }
  }
  const rawItems: unknown[] = record.items

  if (unit === 'trombiTitles') {
    const titles = readTitlesItems(rawItems)
    if (!titles) {
      return { kind: 'invalid', reason: 'la charge utile ne porte aucun objet de titre' }
    }
    return { kind: 'titles', titles, unit }
  }

  const items = rawItems.filter(isCollectionItem)
  if (items.length !== rawItems.length) {
    return { kind: 'invalid', reason: "une entrée de la charge utile n'est pas un objet portant un id" }
  }
  return { items, kind: 'items', unit }
}

/** Runtime guard of a photo payload: the envelope plus the player it belongs to. */
export function readPhotoPayload(payload: unknown): PhotoPayloadRead {
  const record = toPayloadRecord(payload)
  if (!record) {
    return { kind: 'invalid', reason: "la charge utile n'est pas un objet" }
  }
  if (record.schema !== NOSTROMO_PAYLOAD_SCHEMA) {
    return { kind: 'invalid', reason: `le schéma de la charge utile n'est pas ${NOSTROMO_PAYLOAD_SCHEMA}` }
  }
  if (record.type !== 'photo' || typeof record.playerId !== 'string' || record.playerId === '') {
    return { kind: 'invalid', reason: "la charge utile ne désigne pas la photo d'un joueur" }
  }
  return { kind: 'valid', playerId: record.playerId }
}

/**
 * Reads a payload as a plain object, refusing arrays and `null`: the entry point
 * of every read below and of the listing that groups the remote documents.
 */
export function toPayloadRecord(payload: unknown): Record<string, unknown> | undefined {
  return isPlainRecord(payload) ? payload : undefined
}

/** Single description helper of the sync layer: every failure is logged through it. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Title object of a `trombiTitles` payload. An empty `items` means "no title
 * set", the state the push engine writes for an empty title.
 */
function readTitlesItems(items: readonly unknown[]): TrombiTitles | undefined {
  const [first] = items
  if (first === undefined) {
    return { teamName: '' }
  }
  return isPlainRecord(first) && typeof first.teamName === 'string' ? { teamName: first.teamName } : undefined
}

function isCollectionItem(value: unknown): value is NostromoCollectionItem {
  return isPlainRecord(value) && typeof value.id === 'string' && value.id !== ''
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
