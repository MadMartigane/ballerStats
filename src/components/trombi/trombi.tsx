import { useNavigate } from '@solidjs/router'
import { ArrowLeft, LayoutGrid } from 'lucide-solid'
import { createMemo, For, Show } from 'solid-js'
import { ROUTE_PLAYERS } from '../../libs/menu/routes'
import type Player from '../../libs/player'
import { hasJerseyNumber } from '../../libs/player/player'
import { players } from '../../libs/players-store'
import BsEmptyPlayerFallback from '../empty-player-fallback'
import BsTrombiPlayerItem from './trombi-player-item'

function sortPlayersByJersey(playersList: Array<Player>): Array<Player> {
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
      <h2 class="my-4 flex flex-row items-center gap-2 print:hidden">
        <LayoutGrid class="h-8 w-8" />
        Trombinoscope
      </h2>

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
