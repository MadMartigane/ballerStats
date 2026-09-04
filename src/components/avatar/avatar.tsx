import { createResource, Show } from 'solid-js'
import { getPhoto } from '../../libs/photo-store/photo-store'
import { useBlobUrl } from '../../libs/photo-store/use-blob-url'
import type { BsAvatarProps } from './avatar.d'

function getPlayerHue(playerId: string): number {
  let hash = 0
  for (let i = 0; i < playerId.length; i += 1) {
    // biome-ignore lint/suspicious/noBitwiseOperators: legacy hue hash; changing it alters existing avatar colors
    hash = playerId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

export default function BsAvatar(props: BsAvatarProps) {
  const [photoBlob] = createResource(
    () => (props.hasPhoto ? props.playerId : null),
    async (id) => (id ? getPhoto(id) : undefined)
  )

  const url = useBlobUrl(() => (props.hasPhoto ? photoBlob() : undefined))

  const size = () => props.size ?? 64
  const initial = () => (props.displayName || '?').charAt(0).toUpperCase()
  const hue = () => getPlayerHue(props.playerId)

  return (
    <Show
      fallback={
        <div
          class="flex items-center justify-center rounded-full font-bold text-white"
          style={{
            'background-color': `hsl(${hue()}, 70%, 45%)`,
            'font-size': `${size() * 0.4}px`,
            height: `${size()}px`,
            width: `${size()}px`,
          }}
        >
          {initial()}
        </div>
      }
      when={url()}
    >
      {(blobUrl) => (
        <img alt={props.displayName} class="rounded-full object-cover" height={size()} src={blobUrl()} width={size()} />
      )}
    </Show>
  )
}
