import { useNavigate } from '@solidjs/router'
import { ArrowLeft } from 'lucide-solid'
import { For, Show } from 'solid-js'
import { ROUTE_PLAYERS } from '../../libs/menu/routes'
import { titles, updateTitle } from '../../libs/trombi-titles-store'
import BsEmptyPlayerFallback from '../empty-player-fallback'
import BsInlineEditableTitle from '../inline-editable-title/inline-editable-title'
import type { BsTrombiProps } from './trombi.d'
import BsTrombiPlayerItem from './trombi-player-item'

export default function BsTrombi(props: BsTrombiProps) {
  const navigate = useNavigate()

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
        {props.staticTeamName === undefined ? (
          <BsInlineEditableTitle
            ariaLabel="Nom de l'équipe"
            headingLevel="h2"
            onSave={(value) => updateTitle('teamName', value)}
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
        <div class="flex flex-col gap-3">
          <For each={props.players}>{(player) => <BsTrombiPlayerItem player={player} />}</For>
        </div>
      </Show>

      <hr class="print:hidden" />
      <div class="footer-buttons-container print:hidden">
        <button
          class="btn btn-secondary print:hidden"
          onClick={() => {
            navigate(props.backRoute ?? ROUTE_PLAYERS)
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
