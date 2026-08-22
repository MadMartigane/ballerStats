import { Shirt, Trash, UserPen } from 'lucide-solid'
import { Show } from 'solid-js'
import orchestrator from '../../libs/orchestrator/orchestrator'
import type Player from '../../libs/player/player'
import { confirmAction, toast } from '../../libs/utils/utils'
import BsAvatar from '../avatar/avatar'
import BsTile from '../tile/tile'
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

function makeEditPlayerClickHandler(player: Player, onEdit: BsPlayerProps['onEdit']) {
  return () => {
    editPlayer(player, onEdit)
  }
}

function makeRemovePlayerClickHandler(player: Player) {
  return () => {
    removePlayer(player).catch(() => toast('Erreur lors de la suppression du joueur.', 'error'))
  }
}

export default function BsPlayer(props: BsPlayerProps) {
  const { player } = props
  const editPlayerLabel = 'Modifier le joueur'
  const deletePlayerLabel = 'Supprimer le joueur'
  return (
    <BsTile
      badge={
        <div class="mt-2 flex flex-none flex-row text-accent">
          <Shirt class="h-8 w-8" /> <span class="min-w-8">{player.jerseyNumber}</span>
        </div>
      }
      footer={
        <>
          <Show when={props.onEdit}>
            <div class="tooltip tooltip-top" data-tip={editPlayerLabel}>
              <button
                aria-label={editPlayerLabel}
                class="btn btn-secondary btn-square"
                onClick={makeEditPlayerClickHandler(player, props.onEdit)}
                type="button"
              >
                <UserPen />
              </button>
            </div>
          </Show>
          <div class="tooltip tooltip-top" data-tip={deletePlayerLabel}>
            <button
              aria-label={deletePlayerLabel}
              class="btn btn-secondary btn-square"
              onClick={makeRemovePlayerClickHandler(player)}
              type="button"
            >
              <Trash />
            </button>
          </div>
        </>
      }
      header={
        <BsAvatar
          displayName={player.nicName || player.firstName || '?'}
          hasPhoto={player.hasPhoto}
          playerId={player.id}
          size={64}
        />
      }
      info={player.licenseNumber}
      title={player.nicName ? player.nicName : player.firstName}
    >
      {`${player.firstName || ''} ${player.lastName || ''}`}
    </BsTile>
  )
}
