import { useNavigate } from '@solidjs/router'
import { ArrowLeft } from 'lucide-solid'
import { createMemo, For, Show } from 'solid-js'
import { ROUTE_PLAYERS } from '../../libs/menu/routes'
import type Player from '../../libs/player'
import { hasJerseyNumber } from '../../libs/player/player'
import { players } from '../../libs/players-store'
import { updateTitle, titles } from '../../libs/trombi-titles-store'
import BsEmptyPlayerFallback from '../empty-player-fallback'
import BsInlineEditableTitle from '../inline-editable-title/inline-editable-title'
import BsTrombiPlayerItem from './trombi-player-item'

function sortPlayersByJersey(playersList: Player[]): Player[] {
  const withJersey = playersList
    .filter((p) => hasJerseyNumber(p))
    .sort((a, b) => Number.parseInt(a.jerseyNumber, 10) - Number.parseInt(b.jerseyNumber, 10))
  const withoutJersey = playersList.filter((p) => !hasJerseyNumber(p))
  return [...withJersey, ...withoutJersey]
}

export default function BsTrombi() {
  const navigate = useNavigate()
  const sortedPlayers = createMemo(() => sortPlayersByJersey(players))

  return (
    <div>
      <div class="my-4 flex flex-col items-center gap-1">
        <BsInlineEditableTitle
          ariaLabel="Nom du club"
          headingLevel="h1"
          onSave={(value) => updateTitle('clubName', value)}
          placeholder="Nom du club"
          value={titles.clubName}
        />
        <BsInlineEditableTitle
          ariaLabel="Nom de l'équipe"
          headingLevel="h2"
          onSave={(value) => updateTitle('teamName', value)}
          placeholder="Nom de l'équipe"
          value={titles.teamName}
        />
      </div>

      <Show fallback={<BsEmptyPlayerFallback />} when={sortedPlayers().length > 0}>
        <div class="flex flex-col gap-3">
          <For each={sortedPlayers()}>{(player) => <BsTrombiPlayerItem player={player} />}</For>
        </div>
      </Show>

      <hr class="print:hidden" />
      <div class="footer-buttons-container print:hidden">
        <button
          class="btn btn-secondary print:hidden"
          onClick={() => {
            navigate(ROUTE_PLAYERS)
          }}
          type="button"
        >
          <ArrowLeft />
          Retour
        </button>
      </div>
    </div>
  )
}
