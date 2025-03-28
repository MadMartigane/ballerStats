import { Trash, UserPen } from 'lucide-solid'
import { For, Show } from 'solid-js'
import orchestrator from '../../libs/orchestrator/orchestrator'
import type Team from '../../libs/team'
import { confirmAction, scrollTop } from '../../libs/utils'
import BsTile from '../tile'
import type { BsTeamProps } from './team.d'

async function removeTeam(team: Team) {
  const yes = await confirmAction()

  if (yes) {
    orchestrator.Teams.remove(team)
  }
}

function editTeam(team: Team, callback: (team: Team) => void) {
  callback(team)
}

export default function BsTeam(props: BsTeamProps) {
  const team = props.team

  return (
    <>
      <BsTile
        title={team.name || ''}
        footer={
          <>
            <Show when={props.onEdit}>
              <button
                type="button"
                class="btn btn-square btn-secondary"
                onClick={() => {
                  editTeam(team, props.onEdit)
                  scrollTop()
                }}
              >
                <UserPen />
              </button>
            </Show>
            <button
              type="button"
              class="btn btn-square btn-secondary"
              onClick={() => {
                removeTeam(team)
              }}
            >
              <Trash />
            </button>
          </>
        }
      >
        <For each={team.playerIds}>
          {(id) => {
            const player = orchestrator.getPlayer(id)

            if (player) {
              return (
                <p class="">
                  <span class="text-warning">{player.jersayNumber}</span>
                  <span class="p-1">{`${player.nicName || player.firstName} ${(player.nicName && '') || player.lastName}`}</span>
                </p>
              )
            }
            ;<p class="text-error">{`Joueur id ${id} introuvable`}</p>
          }}
        </For>
      </BsTile>
    </>
  )
}
