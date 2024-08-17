import { FilePenLine, Play, Trash } from 'lucide-solid'
import { Show } from 'solid-js'
import type { BsMatchTileProps, BsMatchTypeTextProps } from './match-tile.d'
import BsButton from '../button'
import Match from '../../libs/match'
import orchestrator from '../../libs/orchestrator/orchestrator'

function removeMatch(match: Match) {
  orchestrator.Matchs.remove(match)
}

function callCallback(match: Match, callback?: (match: Match) => void) {
  if (!callback) {
    return
  }

  callback(match)
}

export function BsMatchTypeText(props: BsMatchTypeTextProps) {
  const type = props.type

  return (
    <>
      <Show when={type === 'home'}>
        <span class="dark:text-lime-200 text-lime-800">🡫 Domicile</span>
      </Show>
      <Show when={type === 'outside'}>
        <span class="dark:text-pink-200 text-pink-800">🡬 Extérieur</span>
      </Show>
      <Show when={!type}>{'Type non renseigné'}</Show>
    </>
  )
}

export default function BsMatchTile(props: BsMatchTileProps) {
  const match = props.match
  const team = orchestrator.getTeam(match.teamId)

  return (
    <div class="min-w-80 max-w-80 w-80 flex flex-col bg-white border border-t-4 border-t-blue-600 shadow-sm hover:shadow-xl rounded-xl hover:bg-zinc-100 hover:dark:bg-neutral-950 dark:bg-neutral-900 dark:border-neutral-700 dark:border-t-blue-500 dark:shadow-neutral-700/70">
      <div class="p-4 md:p-5 flex flex-row gap-4">
        <h3 class="text-lg grow text-balance font-bold text-gray-800 dark:text-white">
          {match.opponent}
        </h3>
        <div>
          <div>
            <BsMatchTypeText type={match.type} />
          </div>
        </div>
      </div>
      <Show when={team}>
        <p class="px-4 md:px-5">
          {team?.name} ({team?.playerIds.length})
        </p>
      </Show>

      <hr />

      <div class="p-4 md:p-5 w-11/12 text-sm flex flex-row gap-2 content-end justify-end">
        <Show when={props.onStart}>
          <BsButton
            size="sm"
            variant="light"
            onClick={() => {
              callCallback(match, props?.onStart)
            }}
          >
            <Play />
          </BsButton>
        </Show>

        <Show when={props.onEdit}>
          <BsButton
            size="sm"
            variant="light"
            onClick={() => {
              callCallback(match, props?.onEdit)
            }}
          >
            <FilePenLine />
          </BsButton>
        </Show>

        <BsButton
          size="sm"
          variant="light"
          onClick={() => {
            removeMatch(match)
          }}
        >
          <Trash />
        </BsButton>
      </div>
    </div>
  )
}
