/**
 * Robust photo download and `hasPhoto` consistency.
 *
 * - a file token is minted once per download batch, kept in a closure, never
 *   stored and never logged (only the fact that one was obtained is),
 * - a download is retried up to `PHOTO_MAX_ATTEMPTS` times on a network failure
 *   or a 5xx, never on a 404, and a 401/403 refetches the token once,
 * - a downloaded blob is accepted only when it is a non-empty image, within the
 *   client ceiling, whose size matches the size the server reports (when it
 *   reports one): a refused blob leaves the old local photo untouched,
 * - `reconcileHasPhoto` applies the single rule: after a pull, a player has a
 *   photo if and only if the photo store holds one.
 */
import { getAllPhotoEntries } from '../photo-store/photo-store'
import { storePlayers } from '../store/store'
import { getRawPlayers, hydratePlayers } from '../stores/players-store'
import { downloadFile, getDocument, getFileToken, NostromoClientError } from './client'
import type { NostromoDocument } from './client.d'
import { NOSTROMO_MAX_PHOTO_BYTES } from './limits'
import type { NostromoConfig } from './nostromo-config-store.d'
import { pushNostromoLog } from './nostromo-sync-store'

/** Attempts of one download, the first one included. */
export const PHOTO_MAX_ATTEMPTS = 3

/** Wait before the second attempt: it doubles for each further one (1 s, then 2 s). */
export const PHOTO_RETRY_BASE_DELAY_MS = 1000

const HTTP_FORBIDDEN = 403
const HTTP_SERVER_ERROR_MIN = 500
const IMAGE_MIME_PREFIX = 'image/'

/** Hands out the file token of one download batch. Nothing here outlives the closure. */
export interface FileTokenSession {
  /** Returns the token of the batch, minting it on the first call. */
  get: () => Promise<string>
  /** Discards the current token and mints a new one (after a 401/403 on a download). */
  refresh: () => Promise<string>
}

export function createFileTokenSession(config: NostromoConfig): FileTokenSession {
  let current: Promise<string> | undefined
  const mint = (): Promise<string> => {
    const minted = getFileToken(config.baseUrl, config.token).then((token) => {
      pushNostromoLog('info', 'Jeton de fichier obtenu.')
      return token
    })
    current = minted
    return minted
  }
  return {
    get: () => current ?? mint(),
    refresh: () => mint(),
  }
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs)
  })
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof NostromoClientError)) {
    return false
  }
  return error.kind === 'network' || (error.status !== undefined && error.status >= HTTP_SERVER_ERROR_MIN)
}

function isTokenRefused(error: unknown): boolean {
  return error instanceof NostromoClientError && (error.kind === 'auth' || error.status === HTTP_FORBIDDEN)
}

/**
 * Throws when the blob is not an acceptable photo. Pure: the caller decides what
 * a refusal means for the local copy (nothing is touched here).
 */
export function assertPhotoIntegrity(blob: Blob, document: NostromoDocument): void {
  if (blob.size === 0) {
    throw new Error(`Photo ${document.id} refusée : le fichier téléchargé est vide.`)
  }
  if (blob.size > NOSTROMO_MAX_PHOTO_BYTES) {
    throw new Error(`Photo ${document.id} refusée : ${blob.size} octets, au-dessus de la limite.`)
  }
  if (!blob.type.startsWith(IMAGE_MIME_PREFIX)) {
    throw new Error(`Photo ${document.id} refusée : le type « ${blob.type} » n'est pas une image.`)
  }
  if (document.fileSize !== undefined && document.fileSize !== blob.size) {
    throw new Error(
      `Photo ${document.id} refusée : ${blob.size} octets reçus pour ${document.fileSize} annoncés (fichier tronqué).`
    )
  }
}

/** One download with its retries. A 401/403 refetches the token once, a 404 is never retried. */
async function downloadWithRetry(
  config: NostromoConfig,
  session: FileTokenSession,
  docId: string,
  filename: string
): Promise<Blob> {
  let token = await session.get()
  let tokenRefreshed = false
  let attempt = 1
  for (;;) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: each attempt depends on the failure of the previous one.
      return await downloadFile(config.baseUrl, token, docId, filename)
    } catch (error) {
      if (isTokenRefused(error) && !tokenRefreshed) {
        tokenRefreshed = true
        token = await session.refresh()
        continue
      }
      if (!isRetryable(error) || attempt >= PHOTO_MAX_ATTEMPTS) {
        throw error
      }
      await delay(PHOTO_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
      attempt += 1
    }
  }
}

/**
 * Downloads the file of a photo document and checks it. On a 404 the document is
 * re-read once (the file may have been replaced since the listing): the new file
 * name is tried once, otherwise the 404 stands ("gone or no access").
 */
export async function downloadPhoto(
  config: NostromoConfig,
  session: FileTokenSession,
  document: NostromoDocument
): Promise<Blob> {
  if (!document.file) {
    throw new Error(`Photo ${document.id} : le document ne porte aucun fichier.`)
  }
  let current = document
  let blob: Blob
  try {
    blob = await downloadWithRetry(config, session, document.id, document.file)
  } catch (error) {
    if (!(error instanceof NostromoClientError && error.kind === 'notfound')) {
      throw error
    }
    const fresh = await getDocument(config.baseUrl, config.token, document.id)
    if (!fresh.file || fresh.file === document.file) {
      throw error
    }
    current = fresh
    blob = await downloadWithRetry(config, session, fresh.id, fresh.file)
  }
  assertPhotoIntegrity(blob, current)
  return blob
}

/**
 * Single `hasPhoto` rule: a player has a photo if and only if the photo store
 * holds one. Applied through the players `hydrate` path (no dirty mark: the flag
 * is derived data, the same on every device) and persisted once, only when a flag
 * actually changed. A blob without a player is reported, not deleted: deleting it
 * would queue a remote deletion of a photo another device may still use.
 */
export async function reconcileHasPhoto(): Promise<void> {
  const photoIds = new Set((await getAllPhotoEntries()).map((entry) => entry.playerId))
  const players = getRawPlayers()
  let changed = 0
  const reconciled = players.map((player) => {
    const hasPhoto = player.id !== undefined && photoIds.has(player.id)
    if ((player.hasPhoto ?? false) === hasPhoto) {
      return player
    }
    changed += 1
    return { ...player, hasPhoto }
  })

  const playerIds = new Set(players.map((player) => player.id))
  for (const photoId of photoIds) {
    if (!playerIds.has(photoId)) {
      pushNostromoLog('warn', `Photo du joueur ${photoId} ignorée : ce joueur n'existe pas localement.`)
    }
  }
  if (changed === 0) {
    return
  }
  hydratePlayers(reconciled)
  await storePlayers(getRawPlayers())
  pushNostromoLog('info', `Indicateur de photo corrigé pour ${changed} joueur(s).`)
}
