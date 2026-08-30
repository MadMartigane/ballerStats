import type PocketBase from 'pocketbase'
import { deletePhoto, getPhoto, storePhoto } from '../photo-store/photo-store'
import type { RemoteRecord } from './sync.d'

/**
 * Upload decision: a photo becomes pending when the local player has a blob
 * and the last-synced snapshot did not (or the player is brand new). The
 * remote `hasPhoto` flag is compared against the snapshot so the same player
 * is not re-uploaded on every cycle.
 */
export function shouldUploadPhoto(input: {
  localHasBlob: boolean
  localHasPhoto: boolean
  snapshotHasPhoto: boolean
}): boolean {
  return input.localHasPhoto && input.localHasBlob && !input.snapshotHasPhoto
}

/** Download decision: remote advertises a photo but no local blob exists yet. */
export function shouldDownloadPhoto(input: { localHasBlob: boolean; remoteHasPhoto: boolean }): boolean {
  return input.remoteHasPhoto && !input.localHasBlob
}

/**
 * Uploads the local blob for `playerId` on the PB record `pbId` (multipart
 * `photo` field).
 */
export async function uploadPlayerPhoto(pb: PocketBase, pbId: string, blob: Blob): Promise<void> {
  await pb.collection('players').update(pbId, { photo: blob })
}

/** File access token so protected files keep working if a fileRule is added later. */
export async function getFileAuthToken(pb: PocketBase): Promise<string> {
  try {
    const token = await pb.files.getToken()
    return typeof token === 'string' && token !== '' ? token : ''
  } catch {
    return ''
  }
}

export function buildPhotoUrl(pb: PocketBase, record: RemoteRecord, token?: string): string {
  const filename = typeof record.photo === 'string' ? record.photo : ''
  if (filename === '') {
    return ''
  }
  const url = pb.files.getURL(record, filename)
  if (!token) {
    return url
  }
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

/** Downloads the remote photo blob into the local IndexedDB store. */
export async function downloadRemotePhoto(pb: PocketBase, record: RemoteRecord, token?: string): Promise<boolean> {
  const url = buildPhotoUrl(pb, record, token)
  if (url === '') {
    return false
  }
  const response = await fetch(url)
  if (!response.ok) {
    return false
  }
  const blob = await response.blob()
  await storePhoto(record.id, blob)
  return true
}

/** Re-keys a player photo blob after a server-side id rewrite. */
export async function movePhotoKey(fromPlayerId: string, toPlayerId: string): Promise<void> {
  if (fromPlayerId === toPlayerId) {
    return
  }
  const blob = await getPhoto(fromPlayerId)
  if (!blob) {
    return
  }
  await storePhoto(toPlayerId, blob)
  await deletePhoto(fromPlayerId)
}
