import { Shirt, Trash, UserPen } from 'lucide-solid'
import { Show } from 'solid-js'
import orchestrator from '../../libs/orchestrator/orchestrator'
import type Player from '../../libs/player'
import { confirmAction } from '../../libs/utils'
import BsTile from '../tile'
import type { BsPlayerProps } from './player.d'

async function removePlayer(player: Player) {
  const yes = await confirmAction()

  if (yes) {
    orchestrator.Players.remove(player)
  }
}

function editPlayer(player: Player, callback: (player: Player) => void) {
  callback(player)
}

export default function BsPlayer(props: BsPlayerProps) {
  const player = props.player

  return (
    <BsTile
      badge={
        <div class="mt-2 flex flex-none flex-row text-accent">
          <Shirt class="h-8 w-8" /> <span class="min-w-8">{player.jersayNumber}</span>
        </div>
      }
      footer={
        <>
          <Show when={props.onEdit}>
            <button
              class="btn btn-secondary btn-square"
              onClick={() => {
                editPlayer(player, props.onEdit)
              }}
              type="button"
            >
              <UserPen />
            </button>
          </Show>
          <button
            class="btn btn-secondary btn-square"
            onClick={() => {
              removePlayer(player)
            }}
            type="button"
          >
            <Trash />
          </button>
        </>
      }
      title={player.nicName ? player.nicName : player.firstName}
    >
      {`${player.firstName || ''} ${player.lastName || ''}`}
    </BsTile>
  )
}
