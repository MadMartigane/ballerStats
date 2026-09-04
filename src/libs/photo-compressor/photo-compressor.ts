import type { Options } from 'browser-image-compression'
import imageCompression from 'browser-image-compression'
import { PHOTO_MIME_TYPE } from '../photo-store/photo-store'

const COMPRESSION_OPTIONS: Options = {
  fileType: PHOTO_MIME_TYPE,
  maxSizeMB: 0.1,
  maxWidthOrHeight: 400,
  useWebWorker: true,
}

export function compressPhoto(file: File): Promise<Blob> {
  return imageCompression(file, COMPRESSION_OPTIONS)
}
