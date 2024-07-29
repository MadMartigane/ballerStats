import { Dot } from 'lucide-solid'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator'

function installEventHandlers(
  nbPlayers: MadSignal<number>,
  nbTeams: MadSignal<number>,
) {
  bsEventBus.addEventListener('BS::PLAYERS::CHANGE', () => {
    nbPlayers.set(orchestrator.Players.length)
  })

  bsEventBus.addEventListener('BS::TEAMS::CHANGE', () => {
    nbTeams.set(orchestrator.Teams.length)
  })
}

export default function GlobalStats() {
  const nbPlayers = new MadSignal(orchestrator.Players.length)
  const nbTeams = new MadSignal(orchestrator.Teams.length)

  installEventHandlers(nbPlayers, nbTeams)

  return (
    <div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y-2 text-sm">
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr class="bg-neutral-50 text-neutral-800 dark:text-neutral-200 dark:bg-neutral-900">
              <td class="whitespace-nowrap px-4 py-2"><Dot class="h-8 w-8 text-purple-600 dark:text-purple-300" /></td>
              <td class="whitespace-nowrap px-4 py-2 font-medium">
                Nombre de joueurs
              </td>
              <td class="whitespace-nowrap px-4 py-2">
                {nbPlayers.get()}
              </td>
            </tr>

            <tr class="bg-gray-100 text-gray-900 dark:text-gray-300 dark:bg-gray-900">
              <td class="whitespace-nowrap px-4 py-2"><Dot class="h-8 w-8 text-orange-600 dark:text-orange-300" /></td>
              <td class="whitespace-nowrap px-4 py-2 font-medium">
                Nombre d’équipes
              </td>
              <td class="whitespace-nowrap px-4 py-2">
                {nbTeams.get()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
