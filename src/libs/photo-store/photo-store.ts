import { createStore, del, entries, get, keys, set } from 'idb-keyval'
import { markPhotoDirty } from '../nostromo/dirty-marks'
import type Player from '../player/player'
import { toast } from '../utils/utils'
import type { PhotoEntry } from './photo-store.d'

export const PHOTO_FILE_EXTENSION = '.webp'
export const PHOTO_MIME_TYPE = 'image/webp'

const LOCAL_SAVE_FAILURE_MESSAGE = 'Sauvegarde locale impossible : vos données ne seront pas synchronisées.'

const photoStore = createStore('baller-stats-db', 'photos')

export async function storePhoto(playerId: string, blob: Blob): Promise<void> {
  markPhotoDirty(playerId)
  try {
    await set(playerId, blob, photoStore)
  } catch (error) {
    console.error('set photo failed:', error)
    toast(LOCAL_SAVE_FAILURE_MESSAGE, 'error')
    throw error
  }
}

export function getPhoto(playerId: string): Promise<Blob | undefined> {
  return get<Blob>(playerId, photoStore)
}

export async function deletePhoto(playerId: string): Promise<void> {
  await del(playerId, photoStore)
  // Marked only after a successful local delete, like `clearAllPhotos`: a dirty
  // unit whose blob is already gone would push a remote deletion of a photo the
  // device still holds. `storePhoto` is the deliberate opposite — its mark is a
  // capture that must survive a failed write, so it comes before the write.
  markPhotoDirty(playerId)
}

export async function hasPhoto(playerId: string): Promise<boolean> {
  return (await get<Blob>(playerId, photoStore)) !== undefined
}

/**
 * Deletes every local photo and queues the units whose blob is really gone.
 *
 * Same rule as `deletePhoto` for the sync mark: a photo is marked dirty only
 * once its local deletion succeeded, so a failed deletion never leaves a unit
 * that would push a remote deletion while its blob survives locally. The
 * survivors are reported through the local-save-failure toast and `console.error`,
 * and the call still throws so a caller that wipes the database knows the wipe
 * was partial.
 */
export async function clearAllPhotos(): Promise<void> {
  const storedPlayerIds = await keys<string>(photoStore)
  const survivors: string[] = []
  for (const playerId of storedPlayerIds) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: one deletion at a time, so a failure is attributed to its own photo.
      await del(playerId, photoStore)
    } catch (error) {
      console.error('clear photo failed:', error)
      survivors.push(playerId)
      continue
    }
    markPhotoDirty(playerId)
  }
  if (survivors.length > 0) {
    toast(LOCAL_SAVE_FAILURE_MESSAGE, 'error')
    throw new Error(`Suppression locale impossible : ${survivors.length} photo(s) conservée(s).`)
  }
}

export async function getAllPhotoEntries(): Promise<PhotoEntry[]> {
  const allEntries = await entries<string, Blob>(photoStore)
  return Array.from(allEntries, ([playerId, blob]) => ({ blob, playerId }))
}

export async function setPhotoAndFlag(player: Player, blob: Blob): Promise<void> {
  await storePhoto(player.id, blob)
  player.hasPhoto = true
}

export async function deletePhotoAndFlag(player: Player): Promise<void> {
  await deletePhoto(player.id)
  player.hasPhoto = false
}
