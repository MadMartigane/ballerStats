import type { Accessor } from 'solid-js'
import { createMemo, onCleanup } from 'solid-js'

export function useBlobUrl(blobSource: Accessor<Blob | undefined>): Accessor<string | undefined> {
  return createMemo(() => {
    const blob = blobSource()
    if (!blob) {
      return
    }
    const url = URL.createObjectURL(blob)
    onCleanup(() => URL.revokeObjectURL(url))
    return url
  })
}
