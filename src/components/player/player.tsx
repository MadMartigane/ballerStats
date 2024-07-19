import { Shirt, Trash, UserPen } from 'lucide-solid'
import { Show } from 'solid-js'
import { BsPlayerProps } from './player.d'
import BsButton from '../button'
import Player from '../../libs/player'
import orchestrator from '../../libs/orchestrator/orchestrator'

function removePlayer(player: Player) {
  orchestrator.Players.remove(player)
}

function editPlayer(player: Player, callback: (player: Player) => void) {
  callback(player)
}

export default function BsPlayer(props: BsPlayerProps) {
  const player = props.player

  return (
    <div class="min-w-80 max-w-80 w-80 flex flex-col bg-white border border-t-4 border-t-blue-600 shadow-sm hover:shadow-xl rounded-xl hover:bg-zinc-100 hover:dark:bg-neutral-950 dark:bg-neutral-900 dark:border-neutral-700 dark:border-t-blue-500 dark:shadow-neutral-700/70">
      <div class="p-4 md:p-5 flex flex-row gap-4">
        <h3 class="text-lg grow truncate font-bold text-gray-800 dark:text-white">
          <Show when={player.nicName} fallback={player.firstName}>
            {player.nicName}
          </Show>
        </h3>
        <div class="flex flex-row flex-none text-3xl mt-2 text-amber-600 dark:text-amber-400">
          <Shirt class="w-8 h-8" />{' '}
          <span class="min-w-8">{player.jersayNumber}</span>
        </div>
      </div>
      <div class="px-4 py-1 md:px-5 text-sm">
        <p class="text-gray-700 dark:text-neutral-300">{`${player.firstName || ''} ${player.lastName || ''}`}</p>
      </div>

      <hr />

      <div class="py-4 w-11/12 text-sm flex flex-row gap-2 content-end justify-end">
        <Show when={props.onEdit}>
          <BsButton size="sm" variant="light">
            <UserPen
              onClick={() => {
                editPlayer(player, props.onEdit)
              }}
            />
          </BsButton>
        </Show>
        <BsButton
          size="sm"
          variant="light"
          onClick={() => {
            removePlayer(player)
          }}
        >
          <Trash />
        </BsButton>
      </div>
    </div>
  )
}
