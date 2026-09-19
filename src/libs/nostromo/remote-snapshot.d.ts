/**
 * Public types of the remote snapshot (`./remote-snapshot.ts`).
 *
 * A snapshot is the remote state captured just before a destructive flow
 * propagates: the collection documents and the photo documents with their image
 * files. Only the most recent one is kept — it is a safety net against a human
 * mistake, not an archive.
 */

/** One collection document of a snapshot, as the server held it. */
export interface RemoteSnapshotCollectionDocument {
  /** Client-generated id of the remote document. */
  docId: string
  /** Opaque payload the server stored, replayed as-is on restore. */
  payload: unknown
  /** Version the server held at capture time. */
  version: number
}

/** One photo document of a snapshot, with the image bytes. */
export interface RemoteSnapshotPhotoDocument {
  /** Image bytes downloaded at capture time. */
  blob: Blob
  /** Client-generated id of the remote document. */
  docId: string
  /** Opaque payload the server stored, replayed as-is on restore. */
  payload: unknown
  /** Player the photo belongs to. */
  playerId: string
  /** Version the server held at capture time. */
  version: number
}

/** A whole remote state, captured at one point in time. */
export interface RemoteSnapshot {
  collections: RemoteSnapshotCollectionDocument[]
  /** Epoch milliseconds at which the snapshot was captured. */
  createdAt: number
  /** Internal identifier of the snapshot. */
  id: string
  photos: RemoteSnapshotPhotoDocument[]
  /** Human-readable reason of the destructive flow that armed the capture. */
  reason: string
}

/** What a card can display about the stored snapshot, without the payload. */
export interface RemoteSnapshotDescription {
  collectionCount: number
  createdAt: number
  id: string
  photoCount: number
  reason: string
}

/** What a snapshot restore did. */
export interface RemoteSnapshotRestoreResult {
  /** Number of collection units written back. */
  collections: number
  /** Units that failed for their own reason; the others were still restored. */
  failedUnits: string[]
  /** Number of photo units written back. */
  photos: number
}
