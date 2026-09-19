/**
 * Create-or-adopt of a Nostromo document, shared by the push engine and the
 * snapshot restore.
 *
 * The server answers a create under a taken id with a 400 instead of a 201, and
 * the body does not say whether the id was taken or the create rule refused the
 * payload. Re-reading the id tells the two apart: a readable document is adopted
 * (its version only is learned here, the caller decides what to write with it), a
 * 404 rethrows the original refusal so the caller reports a real error.
 */
import { createDocument, getDocument, NostromoClientError } from './client'
import type { NostromoDocument } from './client.d'
import type { NostromoConfig } from './nostromo-config-store.d'

/** What a write learned about the document of a unit before writing it. */
export interface DocumentStart {
  /** True when the document already existed and only its version was adopted. */
  adopted: boolean
  /** Version the caller must send as `expectedVersion` for its next write. */
  version: number
}

/**
 * Creates the document, or learns the version of the one already stored under
 * that id. The caller owns what happens next: an adopted version is meant to be
 * the `expectedVersion` of a follow-up update (or of the first upload).
 */
export async function createOrAdoptDocument(
  config: NostromoConfig,
  docId: string,
  payload: unknown
): Promise<DocumentStart> {
  try {
    const created = await createDocument(config.baseUrl, config.token, { id: docId, owner: config.userId, payload })
    return { adopted: false, version: created.version }
  } catch (error) {
    if (!isIdRefusal(error)) {
      throw error
    }
    const existing = await readAdoptedDocument(config, docId, error)
    return { adopted: true, version: existing.version }
  }
}

/** True when a create was refused with a 400: the id may be taken, the body refused. */
function isIdRefusal(error: unknown): boolean {
  return error instanceof NostromoClientError && error.kind === 'validation' && error.status === 400
}

/** Reads the document the refused create may have collided with, or rethrows the refusal. */
async function readAdoptedDocument(config: NostromoConfig, docId: string, refusal: unknown): Promise<NostromoDocument> {
  try {
    return await getDocument(config.baseUrl, config.token, docId)
  } catch (error) {
    if (error instanceof NostromoClientError && error.kind === 'notfound') {
      throw refusal
    }
    throw error
  }
}
