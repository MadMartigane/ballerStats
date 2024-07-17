import { Shirt, Trash, UserPen } from 'lucide-solid'
import { Show } from 'solid-js'
import { PlayerElProps } from './player.d'
import Button from '../button'
import Player from '../../libs/player'
import orchestrator from '../../libs/orchestrator/orchestrator'

function removePlayer(player: Player) {
  orchestrator.removePlayer(player)
}

export default function PlayerEl(props: PlayerElProps) {
  const player = props.player

  return (
    <div class="max-w-md flex flex-col bg-white border border-t-4 border-t-blue-600 shadow-sm rounded-xl dark:bg-neutral-900 dark:border-neutral-700 dark:border-t-blue-500 dark:shadow-neutral-700/70">
      <div class="p-4 md:p-5 grid grid-cols-2 gap-4">
        <h3 class="text-lg font-bold text-gray-800 dark:text-white">
          <Show
            when={player.nicName}
            fallback={`${player.firstName} ${player.lastName}`}
          >
            {player.nicName}
          </Show>
        </h3>
        <div class="text-3xl mt-2 flex flex-row gap-2 text-amber-600 dark:text-amber-400">
          <Shirt class="w-8 h-8" /> <span>{player.jersayNumber}</span>
        </div>
      </div>
      <Show when={player.nicName && (player.firstName || player.lastName)}>
        <div class="px-4 py-1 md:px-5">
          <p class="text-gray-700 dark:text-neutral-300">{`${player.firstName || ''} ${player.lastName || ''}`}</p>
        </div>
      </Show>

      <hr />

      <div class="py-4 w-11/12 text-sm flex flex-row gap-2 content-end justify-end">
        <Button size="sm" variant="light">
          <UserPen />
        </Button>
        <Button
          size="sm"
          variant="light"
          onClick={() => {
            removePlayer(player)
          }}
        >
          <Trash />
        </Button>
      </div>
    </div>
  )
}
