import { Dot } from 'lucide-solid'
import { createMemo } from 'solid-js'
import bsEventBus from '../../libs/event-bus/event-bus'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import { players } from '../../libs/stores/players-store'

function installEventHandlers(nbTeams: MadSignal<number>) {
  bsEventBus.addEventListener('BS::TEAMS::CHANGE', () => {
    nbTeams.set(orchestrator.Teams.length)
  })
}

export default function GlobalStats() {
  const nbPlayers = createMemo(() => players.length)
  const nbTeams = new MadSignal(orchestrator.Teams.length)
  const nbMatchs = new MadSignal(orchestrator.Matchs.length)

  installEventHandlers(nbTeams)

  return (
    <div>
      <div class="overflow-x-auto">
        <h2>Enregistrements:</h2>
        <table class="table-zebra table">
          <tbody>
            <tr>
              <td>
                <Dot class="h-8 w-8 text-purple-600 dark:text-purple-300" />
              </td>
              <td>Nombre de joueurs</td>
              <td>{nbPlayers()}</td>
            </tr>

            <tr>
              <td>
                <Dot class="h-8 w-8 text-orange-600 dark:text-orange-300" />
              </td>
              <td>Nombre d’équipes</td>
              <td>{nbTeams.get()}</td>
            </tr>

            <tr>
              <td>
                <Dot class="h-8 w-8 text-purple-600 dark:text-purple-300" />
              </td>
              <td>Nombre de matchs</td>
              <td>{nbMatchs.get()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
