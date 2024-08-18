import { Shirt, Trash, UserPen } from 'lucide-solid'
import { For, Show } from 'solid-js'
import { BsTeamProps } from './team.d'
import Team from '../../libs/team'
import orchestrator from '../../libs/orchestrator/orchestrator'

function removeTeam(team: Team) {
  orchestrator.Teams.remove(team)
}

function editTeam(team: Team, callback: (team: Team) => void) {
  callback(team)
}

export default function BsTeam(props: BsTeamProps) {
  const team = props.team

  return (
    <div class="min-w-80 max-w-80 w-80 flex flex-col bg-white border border-t-4 border-t-blue-600 shadow-sm hover:shadow-xl rounded-xl hover:bg-zinc-100 hover:dark:bg-neutral-950 dark:bg-neutral-900 dark:border-neutral-700 dark:border-t-blue-500 dark:shadow-neutral-700/70">
      <div class="p-4 md:p-5 flex flex-row gap-4">
        <h3 class="text-lg grow truncate font-bold text-gray-800 dark:text-white">
          {team.name}
        </h3>
      </div>
      <div class="px-4 py-1 md:px-5 text-sm">
        <For each={team.playerIds}>
          {id => {
            const player = orchestrator.getPlayer(id)

            if (player) {
              return (
                <p class="text-gray-700 dark:text-neutral-300">
                  <span class="text-amber-600 dark:text-amber-400">
                    {player.jersayNumber}
                  </span>
                  <span class="p-1">{`${player.nicName || player.firstName} ${(player.nicName && '') || player.lastName}`}</span>
                </p>
              )
            } else {
              ;<p class="text-amber-600 dark:text-amber-400">{`Joueur id ${id} introuvable`}</p>
            }
          }}
        </For>
      </div>

      <hr />

      <div class="py-4 w-11/12 text-sm flex flex-row gap-4 content-end justify-end">
        <Show when={props.onEdit}>
          <button
            class="btn btn-square btn-secondary"
            onClick={() => {
              editTeam(team, props.onEdit)
            }}
          >
            <UserPen />
          </button>
        </Show>
        <button
          class="btn btn-square btn-secondary"
          onClick={() => {
            removeTeam(team)
          }}
        >
          <Trash />
        </button>
      </div>
    </div>
  )
}
