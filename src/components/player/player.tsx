import { Shirt, Trash, UserPen } from 'lucide-solid'
import { Show } from 'solid-js'
import orchestrator from '../../libs/orchestrator/orchestrator'
import type Player from '../../libs/player'
import { confirmAction, toast } from '../../libs/utils'
import BsAvatar from '../avatar/avatar'
import BsTile from '../tile'
import type { BsPlayerProps } from './player.d'

async function removePlayer(player: Player) {
  const yes = await confirmAction()

  if (yes) {
    await orchestrator.Photos.delete(player.id)
    orchestrator.Players.remove(player)
  }
}

function editPlayer(player: Player, callback: (player: Player) => void) {
  callback(player)
}

export default function BsPlayer(props: BsPlayerProps) {
  const player = props.player
  return (
    <div class="flex flex-col items-center gap-2">
      <BsAvatar
        hasPhoto={player.hasPhoto}
        displayName={player.nicName || player.firstName || '?'}
        playerId={player.id}
        size={64}
      />
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
                onClick={() => editPlayer(player, props.onEdit)}
                type="button"
              >
                <UserPen />
              </button>
            </Show>
            <button
              class="btn btn-secondary btn-square"
              onClick={() =>
                removePlayer(player).catch(() => toast('Erreur lors de la suppression du joueur.', 'error'))
              }
              type="button"
            >
              <Trash />
            </button>
          </>
        }
        info={player.licenseNumber}
        title={player.nicName ? player.nicName : player.firstName}
      >
        {`${player.firstName || ''} ${player.lastName || ''}`}
      </BsTile>
    </div>
  )
}
