/**
 * Public types of the Nostromo restore module (`./restore.ts`).
 *
 * A restore plan is a read-only description of what pulling the remote documents
 * would change locally: one entry per unit, carrying the remote state, the local
 * state, the warnings the user must read and whether those warnings require a
 * confirmation before anything is written.
 *
 * Field names follow the sync store: a collection unit is a `NostromoUnitName`,
 * a photo unit is `photo:<playerId>` (`photoUnitName`), and `localBaseline` is
 * the last server state known locally for that unit.
 */
import type { NostromoBaseline, NostromoUnitName } from './nostromo-sync-store.d'

/**
 * What the restore knows about the remote document of a unit, read from one
 * listing (never from a per-document read: the plan costs one round trip per
 * page, not one per unit).
 */
export interface NostromoRemoteSummary {
  /** Client-generated document id of the remote document. */
  docId: string
  /** Stored file name, present on a photo document that carries its image. */
  file?: string
  /** Number of `items` of a collection payload; absent for photos and unreadable payloads. */
  itemCount?: number
  /** Server-assigned timestamp: display and audit only, never a conflict token. */
  updated: string
  /** Server-managed conflict token observed in the listing. */
  version: number
}

/**
 * Plan entry of a collection unit: what a pull would replace and what it would
 * cost. The five reactive collections and the single-object `trombiTitles` all
 * follow this shape.
 */
export interface NostromoCollectionPlanUnit {
  /** Discriminates a collection entry from a photo entry. */
  kind: 'collection'
  /** Last server state known locally, absent when the unit was never pushed. */
  localBaseline?: NostromoBaseline
  /** Number of items held locally (1 when a title is set, 0 otherwise). */
  localCount: number
  /** True when the unit is queued for push: a pull discards those local changes. */
  localDirty: boolean
  /** Remote document of the unit, absent when the server holds none. */
  remote?: NostromoRemoteSummary
  /**
   * False when there is no remote document, or when its payload failed the
   * runtime guard: a pull then skips the unit instead of writing a local state
   * it cannot trust.
   */
  remotePayloadValid: boolean
  /** True when a pull needs the user's explicit agreement for this unit. */
  requiresConfirmation: boolean
  unit: NostromoUnitName
  /** French, user-facing reasons a pull changes or skips this unit. */
  warnings: string[]
}

/**
 * Plan entry of a photo unit. A photo document carries a file, so a pull either
 * downloads it or deletes the local copy that has no remote counterpart.
 */
export interface NostromoPhotoPlanUnit {
  /**
   * True when the photo exists locally and the server holds no document for it:
   * a pull deletes the local copy, which always requires a confirmation.
   */
  deletionRequired: boolean
  kind: 'photo'
  /** Last server state known locally, absent when the photo was never pushed. */
  localBaseline?: NostromoBaseline
  /** True when a local change of that photo is queued for push. */
  localDirty: boolean
  /** True when the player's photo is stored locally. */
  localPhotoExists: boolean
  playerId: string
  /** Remote document of the photo, absent when the server holds no copy. */
  remote?: NostromoRemoteSummary
  /** True when a pull needs the user's explicit agreement for this unit. */
  requiresConfirmation: boolean
  /** `photo:<playerId>`, the sync store unit key of this entry. */
  unit: string
  /**
   * True when the local copy is known to match the remote version (same
   * baseline document and version, no pending local change): a pull skips the
   * download.
   */
  upToDate: boolean
  /** French, user-facing reasons a pull changes or skips this unit. */
  warnings: string[]
}

/** One unit of a plan, collection or photo. */
export type NostromoRestorePlanUnit = NostromoCollectionPlanUnit | NostromoPhotoPlanUnit

/**
 * Everything a pull or an overwrite needs, computed from one listing and the
 * local state. `requiresConfirmation` is the OR of the unit flags, and
 * `warnings` is the whole user-facing list: the listing remarks first (a
 * document that had to be ignored, a unit several documents claim), then the
 * unit warnings prefixed with their unit key.
 */
export interface NostromoRestorePlan {
  collectionUnits: NostromoCollectionPlanUnit[]
  /** Epoch milliseconds at which the listing was read. */
  fetchedAt: number
  /** Number of photos held locally at plan time. */
  localPhotoCount: number
  photoUnits: NostromoPhotoPlanUnit[]
  /** Number of documents the listing returned, readable or not. */
  remoteDocumentCount: number
  /** Number of remote photo documents the plan recognized. */
  remotePhotoCount: number
  /** True when at least one unit needs the user's explicit agreement. */
  requiresConfirmation: boolean
  /** Every warning of the plan, ready to be displayed as a list. */
  warnings: string[]
}

/** What one apply run did, unit by unit: `applied` and `deleted` are disjoint. */
export interface NostromoRestoreResult {
  /** Units whose local state now matches the remote one (or was force-pushed over it). */
  appliedUnits: string[]
  /** Photo units whose local copy was deleted because the server holds none. */
  deletedPhotoUnits: string[]
  /** Units that failed for their own reason: the others were still applied. */
  failedUnits: string[]
  /** Units with nothing to do, or skipped by the payload guard. */
  skippedUnits: string[]
}

/**
 * What the user chose after reading a plan: `pull` brings the remote state in,
 * `overwrite` force-pushes the local state over it, `cancel` writes nothing.
 */
export type NostromoRestoreDecision = 'cancel' | 'overwrite' | 'pull'
