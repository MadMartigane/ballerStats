import { Show } from 'solid-js'
import { hasJerseyNumber } from '../../libs/player/player'
import BsAvatar from '../avatar/avatar'
import type { BsTrombiPlayerItemProps } from './trombi-player-item.d'

export default function BsTrombiPlayerItem(props: BsTrombiPlayerItemProps) {
  return (
    <div class="flex flex-row items-center gap-4 rounded-lg bg-base-300 p-3 break-inside-avoid">
      <BsAvatar
        displayName={props.player.nicName || props.player.firstName || '?'}
        hasPhoto={props.player.hasPhoto}
        playerId={props.player.id}
        size={96}
      />
      <Show when={hasJerseyNumber(props.player)}>
        <div class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-content">
          {props.player.jerseyNumber}
        </div>
      </Show>
      <div class="min-w-0">
        <p class="text-2xl font-bold">
          {props.player.lastName} {props.player.firstName}
        </p>
        <p class="text-base-content/70 text-xl">Licence : {props.player.licenseNumber || '—'}</p>
      </div>
    </div>
  )
}
