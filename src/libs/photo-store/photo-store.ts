import { clear, del, entries, get, set, createStore } from 'idb-keyval'
import type Player from '../player/player'
import type { PhotoEntry } from './photo-store.d'

export const PHOTO_FILE_EXTENSION = '.webp'
export const PHOTO_MIME_TYPE = 'image/webp'

const photoStore = createStore('baller-stats-db', 'photos')

export async function storePhoto(playerId: string, blob: Blob): Promise<void> {
  await set(playerId, blob, photoStore)
}

export async function getPhoto(playerId: string): Promise<Blob | undefined> {
  return get<Blob>(playerId, photoStore)
}

export async function deletePhoto(playerId: string): Promise<void> {
  await del(playerId, photoStore)
}

export async function hasPhoto(playerId: string): Promise<boolean> {
  return (await get<Blob>(playerId, photoStore)) !== undefined
}

export async function clearAllPhotos(): Promise<void> {
  await clear(photoStore)
}

export async function getAllPhotoEntries(): Promise<Array<PhotoEntry>> {
  const allEntries = await entries<string, Blob>(photoStore)
  return Array.from(allEntries, ([playerId, blob]) => ({ playerId, blob }))
}

export async function setPhotoAndFlag(player: Player, blob: Blob): Promise<void> {
  await storePhoto(player.id, blob)
  player.hasPhoto = true
}

export async function deletePhotoAndFlag(player: Player): Promise<void> {
  await deletePhoto(player.id)
  player.hasPhoto = false
}
