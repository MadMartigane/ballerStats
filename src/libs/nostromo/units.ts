/**
 * Model of the synchronized units, shared by the push engine and the restore.
 *
 * A unit is one document: the five list collections, the single-object
 * `trombiTitles`, and one document per player photo (`photo:<playerId>`, whose
 * key is built by `photoUnitName` in `./dirty-marks`). This module is the only
 * place that knows which store backs which unit, so the push and the pull can
 * never disagree about a collection.
 *
 * It reads the collections through the clone getters of their stores and writes
 * a whole collection back through the matching `replaceAll`: it never hydrates,
 * never persists on its own, and never subscribes to anything.
 */
import { storeClubs, storeContacts, storeMatchs, storePlayers, storeTeams } from '../store/store'
import { getRawClubs, hydrateClubs, replaceAllClubs } from '../stores/clubs-store'
import { getRawContacts, hydrateContacts, replaceAllContacts } from '../stores/contacts-store'
import { getRawMatchs, hydrateMatchs, replaceAllMatchs } from '../stores/matchs-store'
import { getRawPlayers, hydratePlayers, replaceAllPlayers } from '../stores/players-store'
import { getRawTeams, hydrateTeams, replaceAllTeams } from '../stores/teams-store'
import type { TrombiTitles } from '../trombi-titles'
import { getTitles, persistTitles } from '../trombi-titles-store'
import { photoDocId } from './client'
import { cancelDirtyDebounce } from './dirty-marks'
import { clearUnitDirtyIfUnchanged, getDirtyRevision, getDirtyUnits } from './nostromo-sync-store'
import type { NostromoListUnitName, NostromoUnitName } from './nostromo-sync-store.d'
import {
  buildCollectionPayload,
  type NostromoCollectionItem,
  type NostromoCollectionPayload,
  type ValidCollectionRead,
} from './payload'

/** One list unit: a store funnelling a whole array of id-carrying items. */
export interface NostromoListUnit {
  /** Number of items held locally. */
  count: () => number
  kind: 'list'
  /** Reads the whole collection, freshly cloned by the store getter. */
  readAll: () => unknown[]
  /**
   * Replaces the whole collection from the items the payload guard validated.
   * The items only proved the identity of their `id`: the store raw type is
   * built from them here, once per unit, and never re-validated field by field.
   */
  replaceAll: (items: NostromoCollectionItem[]) => Promise<void> | void
  /**
   * Replaces the whole collection and persists it locally WITHOUT marking the
   * unit dirty: the content comes from the server, so it must never be pushed back.
   * The store swap is synchronous, the returned promise settles when the local
   * persistence is done.
   */
  replaceAllSilently: (items: NostromoCollectionItem[]) => Promise<void>
}

/** The single-object title unit: one document holding one title object. */
export interface NostromoTitleUnit {
  /** 1 when a title is set, 0 otherwise. */
  count: () => number
  kind: 'titles'
  readAll: () => unknown[]
  /** Replaces the title from the object the payload guard validated. */
  replaceAll: (titles: TrombiTitles) => Promise<void> | void
}

export type NostromoCollectionUnit = NostromoListUnit | NostromoTitleUnit

const LIST_UNITS: Record<NostromoListUnitName, NostromoListUnit> = {
  clubs: {
    count: () => getRawClubs().length,
    kind: 'list',
    readAll: getRawClubs,
    replaceAll: (items) => replaceAllClubs(items),
    replaceAllSilently: (items) => {
      hydrateClubs(items)
      return storeClubs(getRawClubs())
    },
  },
  contacts: {
    count: () => getRawContacts().length,
    kind: 'list',
    readAll: getRawContacts,
    replaceAll: (items) => replaceAllContacts(items),
    replaceAllSilently: (items) => {
      hydrateContacts(items)
      return storeContacts(getRawContacts())
    },
  },
  matchs: {
    count: () => getRawMatchs().length,
    kind: 'list',
    readAll: getRawMatchs,
    replaceAll: (items) => replaceAllMatchs(items),
    replaceAllSilently: (items) => {
      hydrateMatchs(items)
      return storeMatchs(getRawMatchs())
    },
  },
  players: {
    count: () => getRawPlayers().length,
    kind: 'list',
    readAll: getRawPlayers,
    replaceAll: (items) => replaceAllPlayers(items),
    replaceAllSilently: (items) => {
      hydratePlayers(items)
      return storePlayers(getRawPlayers())
    },
  },
  teams: {
    count: () => getRawTeams().length,
    kind: 'list',
    readAll: getRawTeams,
    replaceAll: (items) => replaceAllTeams(items),
    replaceAllSilently: (items) => {
      hydrateTeams(items)
      return storeTeams(getRawTeams())
    },
  },
}

const TITLE_UNIT: NostromoTitleUnit = {
  count: () => (getTitles().teamName.trim().length > 0 ? 1 : 0),
  kind: 'titles',
  readAll: () => [getTitles()],
  replaceAll: (titles) => persistTitles(titles),
}

/**
 * Push order of the units: a reader must see a player's club and team before the
 * player itself, and never a photo whose player is missing.
 */
export const NOSTROMO_PUSH_ORDER: readonly NostromoUnitName[] = [
  'clubs',
  'players',
  'teams',
  'matchs',
  'contacts',
  'trombiTitles',
]

/** Plan order of the units: alphabetical, so a restore plan is built and displayed in a stable order. */
export const NOSTROMO_PLAN_ORDER: readonly NostromoUnitName[] = [
  'clubs',
  'contacts',
  'matchs',
  'players',
  'teams',
  'trombiTitles',
]

/** Local access of a unit, list or single-object. */
function getCollectionUnit(unit: NostromoUnitName): NostromoCollectionUnit {
  return unit === 'trombiTitles' ? TITLE_UNIT : LIST_UNITS[unit]
}

/** Number of items a unit holds locally (0 or 1 for the single-object `trombiTitles`). */
export function countCollectionItems(unit: NostromoUnitName): number {
  return getCollectionUnit(unit).count()
}

/** Full collection of a unit, always freshly cloned by its store getter. */
function readCollectionItems(unit: NostromoUnitName): unknown[] {
  return getCollectionUnit(unit).readAll()
}

/** Collection envelope of a unit, built from its local content at call time. */
export function buildUnitPayload(unit: NostromoUnitName): NostromoCollectionPayload {
  return buildCollectionPayload(unit, readCollectionItems(unit))
}

/** Writes a payload that passed the guard into the store of its unit. */
export function applyCollectionPayload(read: ValidCollectionRead): Promise<void> | void {
  if (read.kind === 'titles') {
    return TITLE_UNIT.replaceAll(read.titles)
  }
  return LIST_UNITS[read.unit].replaceAll(read.items)
}

/**
 * Writes a validated payload into the store of its unit without ever marking the
 * unit dirty (the pull path). Returns the local persistence promise. The store
 * swap itself is synchronous, so callers can group several units in one `batch()`.
 */
export function applyCollectionPayloadSilently(read: ValidCollectionRead): Promise<void> {
  if (read.kind === 'titles') {
    return applyTitlesSilently(read.titles)
  }
  return LIST_UNITS[read.unit].replaceAllSilently(read.items)
}

/**
 * The titles store has no `hydrate` variant: its only writer marks the unit
 * dirty, synchronously. The mark that write just made is undone through the
 * revision-aware clear, so a mark set by anyone else stays queued. The debounce
 * is only disarmed when nothing else is pending.
 */
function applyTitlesSilently(titles: TrombiTitles): Promise<void> {
  const revisionBeforeWrite = getDirtyRevision('trombiTitles')
  persistTitles(titles)
  clearUnitDirtyIfUnchanged('trombiTitles', revisionBeforeWrite + 1)
  if (getDirtyUnits().length === 0) {
    cancelDirtyDebounce()
  }
  return Promise.resolve()
}

/** Document id of a collection unit: derived from its name alone, identical on every machine. */
export function collectionDocId(unit: NostromoUnitName): string {
  return photoDocId(`collection:${unit}`)
}

/** True when the value names a collection unit of this version. */
export function isCollectionUnitName(value: unknown): value is NostromoUnitName {
  return typeof value === 'string' && (NOSTROMO_PLAN_ORDER as readonly string[]).includes(value)
}
