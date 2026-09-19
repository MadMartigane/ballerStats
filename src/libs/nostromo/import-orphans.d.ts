/**
 * Public types of the import orphan cleanup (`./import-orphans.ts`).
 *
 * An orphan is a remote photo document the imported `.bstat` archive does not
 * hold. Keeping it would let a later restore bring back a photo the imported
 * data never contained, so the import flow proposes to delete it from the server.
 */

/** One remote photo document absent from the imported archive. */
export interface OrphanRemotePhoto {
  /** Client-generated id of the remote document. */
  docId: string
  /** Player the remote photo belongs to. */
  playerId: string
  /** Sync unit key of the photo, `photo:<playerId>`. */
  unit: string
}

/** Outcome of one orphan deletion run. */
export interface OrphanRemotePhotoDeletion {
  /** Player ids whose remote photo document is gone (deleted, or already absent). */
  deleted: string[]
  /** Sync unit keys whose deletion failed for a reason other than 404. */
  failed: string[]
}
