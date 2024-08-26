import { Shirt, Trash, UserPen } from 'lucide-solid'
import { Show } from 'solid-js'
import { BsPlayerProps } from './player.d'
import Player from '../../libs/player'
import orchestrator from '../../libs/orchestrator/orchestrator'
import BsTile from '../tile'
import { confirmAction } from '../../libs/utils'

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
      title={player.nicName ? player.nicName : player.firstName}
      badge={
        <div class="flex flex-row flex-none mt-2 text-accent">
          <Shirt class="w-8 h-8" />{' '}
          <span class="min-w-8">{player.jersayNumber}</span>
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
            >
              <UserPen />
            </button>
          </Show>
          <button
            class="btn btn-secondary btn-square"
            onClick={() => {
              removePlayer(player)
            }}
          >
            <Trash />
          </button>
        </>
      }
    >
      {`${player.firstName || ''} ${player.lastName || ''}`}
    </BsTile>
  )
}
