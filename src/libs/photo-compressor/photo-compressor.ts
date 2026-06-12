import imageCompression from 'browser-image-compression'
import type { Options } from 'browser-image-compression'
import { PHOTO_MIME_TYPE } from '../photo-store/photo-store'

const COMPRESSION_OPTIONS: Options = {
  maxSizeMB: 0.1,
  maxWidthOrHeight: 400,
  fileType: PHOTO_MIME_TYPE,
  useWebWorker: true,
}

export async function compressPhoto(file: File): Promise<Blob> {
  return imageCompression(file, COMPRESSION_OPTIONS)
}
