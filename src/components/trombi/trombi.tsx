import { useNavigate } from '@solidjs/router'
import { ArrowLeft } from 'lucide-solid'
import { createMemo, For, Show } from 'solid-js'
import { clubs } from '../../libs/clubs-store'
import { ROUTE_PLAYERS } from '../../libs/menu/routes'
import { titles, updateTitle } from '../../libs/trombi-titles-store'
import BsEmptyPlayerFallback from '../empty-player-fallback/empty-player-fallback'
import BsInlineEditableTitle from '../inline-editable-title/inline-editable-title'
import type { BsTrombiProps } from './trombi.d'
import BsTrombiPlayerItem from './trombi-player-item'

function saveTeamName(value: string) {
  updateTitle('teamName', value)
}

function makeBackHandler(backRoute: string | undefined, navigate: (path: string) => void) {
  return () => {
    navigate(backRoute ?? ROUTE_PLAYERS)
  }
}

export default function BsTrombi(props: BsTrombiProps) {
  const navigate = useNavigate()
  const currentClub = createMemo(() => clubs[0])

  return (
    <div>
      <div class="my-4 flex flex-col items-center gap-1">
        <h1 class="font-extrabold text-3xl">
          <Show fallback={<i>Nom du club</i>} when={currentClub()?.name}>
            {currentClub()?.name}
          </Show>
        </h1>
        <p class="text-base-content/70 text-xl">
          Licence : <span class="print:font-bold">{currentClub()?.licenseNumber || '—'}</span>
        </p>
        {props.staticTeamName === undefined ? (
          <BsInlineEditableTitle
            ariaLabel="Nom de l'équipe"
            headingLevel="h2"
            onSave={saveTeamName}
            placeholder="Nom de l'équipe"
            value={titles.teamName}
          />
        ) : (
          <h2 class="font-bold text-2xl" classList={{ 'opacity-50': !props.staticTeamName }}>
            {props.staticTeamName || 'Équipe sans nom'}
          </h2>
        )}
      </div>

      <Show fallback={<BsEmptyPlayerFallback />} when={props.players.length}>
        <div class="flex flex-col gap-3 print:mx-0 print:w-full print:max-w-none print:gap-4 print:px-0">
          <For each={props.players}>{(player) => <BsTrombiPlayerItem player={player} />}</For>
        </div>
      </Show>

      <hr class="print:hidden" />
      <div class="footer-buttons-container print:hidden">
        <button
          class="btn btn-secondary print:hidden"
          onClick={makeBackHandler(props.backRoute, navigate)}
          type="button"
        >
          <ArrowLeft />
          Retour
        </button>
      </div>
    </div>
  )
}
