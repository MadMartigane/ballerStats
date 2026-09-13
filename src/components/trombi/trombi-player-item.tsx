import { Show } from 'solid-js'
import { hasJerseyNumber } from '../../libs/player/player'
import BsAvatar from '../avatar/avatar'
import type { BsTrombiPlayerItemProps } from './trombi-player-item.d'

export default function BsTrombiPlayerItem(props: BsTrombiPlayerItemProps) {
  return (
    <div class="flex break-inside-avoid flex-row items-center gap-4 rounded-lg bg-base-300 p-3 print:mx-0 print:w-full print:max-w-none print:gap-6 print:rounded-md print:bg-base-200 print:p-4">
      <div class="print:scale-110">
        <BsAvatar
          displayName={props.player.nicName || props.player.firstName || '?'}
          hasPhoto={props.player.hasPhoto}
          playerId={props.player.id}
          size={96}
        />
      </div>
      <Show when={hasJerseyNumber(props.player)}>
        <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-2xl text-primary-content print:h-28 print:w-28 print:shrink-0 print:text-6xl">
          {props.player.jerseyNumber}
        </div>
      </Show>
      <div class="min-w-0">
        <p class="font-bold text-2xl">
          {props.player.lastName} {props.player.firstName}
        </p>
        <div class="text-sm print:text-xl">
          Licence:{' '}
          <span class="print:font-bold print:text-2xl print:tracking-wide">{props.player.licenseNumber || '—'}</span>
        </div>
      </div>
    </div>
  )
}
