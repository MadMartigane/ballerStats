import { useNavigate } from '@solidjs/router'
import { ArrowLeft, LayoutGrid } from 'lucide-solid'
import { createMemo, For, Show } from 'solid-js'
import { ROUTE_PLAYERS } from '../../libs/menu/routes'
import type Player from '../../libs/player'
import { players } from '../../libs/players-store'
import BsAvatar from '../avatar/avatar'
import BsEmptyPlayerFallback from '../empty-player-fallback'

function sortPlayersByJersey(playersList: Array<Player>): Array<Player> {
  const withJersey = playersList
    .filter((p) => Boolean(p.jersayNumber))
    .sort((a, b) => Number.parseInt(a.jersayNumber!) - Number.parseInt(b.jersayNumber!))
  const withoutJersey = playersList.filter((p) => !p.jersayNumber)
  return [...withJersey, ...withoutJersey]
}

export default function BsTrombi() {
  const navigate = useNavigate()
  const sortedPlayers = createMemo(() => sortPlayersByJersey(players))

  return (
    <div>
      <h2 class="my-4 flex flex-row items-center gap-2">
        <LayoutGrid class="h-8 w-8" />
        Trombinoscope
      </h2>

      <Show fallback={<BsEmptyPlayerFallback />} when={sortedPlayers().length > 0}>
        <div class="flex flex-col gap-3">
          <For each={sortedPlayers()}>
            {(player) => (
              <div class="flex flex-row items-center gap-4 rounded-lg bg-base-300 p-3">
                <BsAvatar
                  displayName={player.nicName || player.firstName || '?'}
                  hasPhoto={player.hasPhoto}
                  playerId={player.id}
                  size={80}
                />
                <div>
                  <p class="font-bold">
                    {player.lastName} {player.firstName}
                  </p>
                  <p class="text-base-content/70 text-sm">Licence : {player.licenseNumber || '—'}</p>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <hr />
      <div class="footer-buttons-container">
        <button
          class="btn btn-secondary"
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
