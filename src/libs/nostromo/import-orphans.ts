/**
 * Import-side orphan cleanup: no remote photo document may survive an import
 * without a counterpart in the imported archive.
 *
 * The `.bstat` import flow replaces the local data; the photo documents the
 * server holds for players the archive does not carry would otherwise come back
 * at the next restore. This module only reads the remote state and deletes those
 * documents, reusing the deletion mechanics of `pushDeletedPhoto` (one
 * `deleteDocument`, tolerating a 404). It never announces anything: the caller
 * owns the confirmation.
 *
 * Hard constraint: the import must stay functional and independent from the
 * sync. Every entry point degrades to a no-op when Nostromo is unconfigured, and
 * the caller treats a failure here as a warning, never as an import failure.
 *
 * Invariant: an orphan is remote-only BY CONSTRUCTION. The caller runs this only
 * after a full local wipe (`clearAllPhotos`), so no local blob can exist for an
 * orphan id; the wipe also queued every surviving-photo unit for deletion, and
 * those units are skipped here. Without that wipe the previous device photos
 * would survive locally while their remote documents got deleted — the caller
 * therefore skips this cleanup entirely when the wipe was declined. A user who
 * declines the orphan deletion keeps the server copies ("server wins" drift,
 * recoverable through a later restore).
 */
import { deleteDocument, NostromoClientError } from './client'
import type { NostromoDocument } from './client.d'
import { photoUnitName } from './dirty-marks'
import type { OrphanRemotePhoto, OrphanRemotePhotoDeletion } from './import-orphans.d'
import { listAllRemoteDocuments } from './listing'
import { getConfig, isConfigured } from './nostromo-config-store'
import { clearBaseline, getDirtyUnits, pushNostromoLog } from './nostromo-sync-store'
import { describeError, readPhotoPayload } from './payload'

/**
 * Lists the remote photo documents the imported archive does not hold.
 *
 * The comparison is by player id: the archive's photo set is exactly the keys of
 * the photos map built by the import parser (a player flagged `hasPhoto` whose
 * blob is missing from the archive is not a photo of the archive).
 *
 * A unit already queued for push is skipped: a local wipe marks every photo it
 * cleared dirty, and the engine's `pushDeletedPhoto` will delete those remote
 * documents itself. Callers must therefore list AFTER the local wipe so the two
 * deletions do not overlap (the overlap would be 404-tolerant, but announcing a
 * document the engine is about to delete would be dishonest).
 *
 * `listedDocuments` lets the import flow reuse the listing its pre-destructive
 * snapshot already read: the two passes see the same remote state, so the orphan
 * computation needs no second traversal. A caller with no listing leaves it
 * undefined and gets a fresh one.
 *
 * Returns an empty list when Nostromo is unconfigured: no client call is made.
 */
export async function listOrphanRemotePhotos(
  importedPlayerIds: ReadonlySet<string>,
  listedDocuments?: readonly NostromoDocument[]
): Promise<OrphanRemotePhoto[]> {
  if (!isConfigured()) {
    return []
  }
  const config = getConfig()
  if (!config) {
    return []
  }

  const documents = listedDocuments ?? (await listAllRemoteDocuments(config))
  const pendingDeletion = new Set(getDirtyUnits())
  const orphans: OrphanRemotePhoto[] = []

  for (const document of documents) {
    const read = readPhotoPayload(document.payload)
    if (read.kind === 'invalid' || importedPlayerIds.has(read.playerId)) {
      continue
    }
    const unit = photoUnitName(read.playerId)
    if (pendingDeletion.has(unit)) {
      continue
    }
    orphans.push({ docId: document.id, playerId: read.playerId, unit })
  }

  return orphans
}

/**
 * Deletes the given remote photo documents and clears their stale baselines. A
 * document the server no longer holds (404) counts as deleted: the outcome is
 * the same. Never throws: a per-document failure is logged and reported, so a
 * flaky network degrades the cleanup instead of failing the import.
 */
export async function deleteOrphanRemotePhotos(
  orphans: readonly OrphanRemotePhoto[]
): Promise<OrphanRemotePhotoDeletion> {
  const deletion: OrphanRemotePhotoDeletion = { deleted: [], failed: [] }
  if (orphans.length === 0) {
    return deletion
  }
  const config = getConfig()
  if (!config) {
    return deletion
  }

  for (const orphan of orphans) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one deletion at a time, and a failure is reported per document.
      await deleteDocument(config.baseUrl, config.token, orphan.docId)
    } catch (error) {
      if (!isNotFoundError(error)) {
        deletion.failed.push(orphan.unit)
        pushNostromoLog(
          'warn',
          `Import Nostromo : la suppression de la photo distante du joueur ${orphan.playerId} a échoué : ${describeError(error)}`
        )
        continue
      }
    }
    clearBaseline(orphan.unit)
    deletion.deleted.push(orphan.playerId)
    pushNostromoLog(
      'info',
      `Import Nostromo : photo distante orpheline du joueur ${orphan.playerId} supprimée (document ${orphan.docId}).`
    )
  }

  return deletion
}

/** True when the document is already gone: the deletion reached its goal anyway. */
function isNotFoundError(error: unknown): boolean {
  return error instanceof NostromoClientError && error.kind === 'notfound'
}
