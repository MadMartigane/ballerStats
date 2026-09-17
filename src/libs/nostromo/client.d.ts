/**
 * Public types of the Nostromo client (`./client.ts`).
 *
 * Contract: the Nostromo SDK integration guide, sections 3 (backend contract)
 * and 4 (required client behaviors). Field names are the server's, verbatim.
 */

/**
 * How a Nostromo call failed. The sync layer branches on this, never on a
 * message: `conflict` and `notfound` in particular must be told apart, they
 * have opposite recovery paths (guide, 3.3 and 4.3).
 */
export type NostromoErrorKind = 'auth' | 'conflict' | 'network' | 'notfound' | 'unknown' | 'validation'

/**
 * A Nostromo document: the unit of sync. The payload is opaque to the server
 * and owned by this app.
 */
export interface NostromoDocument {
  /** Stored file name, absent when the document carries no file. */
  file?: string
  /** Client-generated id, `^[a-z0-9]{15}$`, final for the document's whole life. */
  id: string
  owner: string
  payload?: unknown
  /** Server-assigned timestamp: display and audit only, NEVER a conflict token. */
  updated: string
  /** Server-managed conflict token, incremented by one on every accepted write. */
  version: number
}

/** What `authWithPassword` returns: the raw token and the user it belongs to. */
export interface NostromoAuthResult {
  token: string
  userId: string
}

/**
 * A document to create. `owner` is required: the server's create rule rejects
 * any create whose `owner` is not the authenticated caller
 * (`@request.body.owner = @request.auth.id`), so a create without it can only
 * ever fail.
 */
export interface NostromoCreateDocumentInput {
  id: string
  owner: string
  payload?: unknown
}

/**
 * A document update. `expectedVersion` is the numeric `version` held locally;
 * the server answers 409 when it is stale, and a missing value is a stale
 * write too (never omit it).
 */
export interface NostromoUpdateDocumentInput {
  expectedVersion: number
  payload?: unknown
}

/** A file upload: the version the client holds plus the bytes to store. */
export interface NostromoUploadFileInput {
  expectedVersion: number
  file: Blob
  filename: string
}

/** Listing options, passed through as PocketBase record listing query parameters. */
export interface NostromoListOptions {
  /**
   * PocketBase filter expression. Timestamps inside it MUST use the native
   * layout produced by `toPocketBaseTimestamp`: the ISO `T` form silently
   * matches zero rows (guide, 3.3).
   */
  filter?: string
  /** 1-based page number. */
  page?: number
  /** Page size, up to 500. */
  perPage?: number
}

/** The PocketBase list envelope, reduced to what this app uses. */
export interface NostromoListResult {
  items: NostromoDocument[]
  page: number
  perPage: number
  totalItems: number
}
