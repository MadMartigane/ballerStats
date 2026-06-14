import { A } from '@solidjs/router'
import { Camera, Trash, UserPen } from 'lucide-solid'
import { For, Show } from 'solid-js'
import { buildTeamTrombiPath } from '../../libs/menu/routes'
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
        footer={
          <>
            <A
              aria-label={`Trombinoscope de l'équipe ${team.name || '(sans nom)'}`}
              class="btn btn-square btn-secondary"
              href={buildTeamTrombiPath(team.id)}
            >
              <Camera />
            </A>
            <Show when={props.onEdit}>
              <button
                class="btn btn-square btn-secondary"
                onClick={() => {
                  editTeam(team, props.onEdit)
                  scrollTop()
                }}
                type="button"
              >
                <UserPen />
              </button>
            </Show>
            <button
              class="btn btn-square btn-secondary"
              onClick={() => {
                removeTeam(team)
              }}
              type="button"
            >
              <Trash />
            </button>
          </>
        }
        title={team.name || ''}
      >
        <For each={team.playerIds}>
          {(id) => {
            const player = orchestrator.getPlayer(id)

            if (player) {
              return (
                <p class="">
                  <span class="text-warning">{player.jerseyNumber}</span>
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
