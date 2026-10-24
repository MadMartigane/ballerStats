/**
 * Client-side limits of the Nostromo synchronization, in a leaf module: any
 * engine or helper can import them without pulling in the engines themselves.
 */

/** Client-side ceiling for a photo upload: a bigger document file is refused before the round trip. */
export const NOSTROMO_MAX_PHOTO_BYTES = 20 * 1024 * 1024
