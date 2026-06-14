import { useParams } from '@solidjs/router'
import { Show } from 'solid-js'
import BsTrombi from '../components/trombi/trombi'
import { ROUTE_TEAMS } from '../libs/menu/routes'
import orchestrator from '../libs/orchestrator/orchestrator'

export default function TrombiTeamPage() {
  const params = useParams()

  return (
    <Show
      fallback={<p class="my-4 text-error">Équipe introuvable.</p>}
      keyed
      when={orchestrator.getTeam(params.teamId)}
    >
      {(t) => (
        <BsTrombi
          backRoute={ROUTE_TEAMS}
          players={orchestrator.getJerseySortedPlayers(t.playerIds)}
          staticTeamName={t.name}
        />
      )}
    </Show>
  )
}
