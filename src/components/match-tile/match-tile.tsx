import { FilePenLine, Play, Trash } from 'lucide-solid'
import { Show } from 'solid-js'
import type { BsMatchTileProps, BsMatchTypeTextProps } from './match-tile.d'
import Match from '../../libs/match'
import orchestrator from '../../libs/orchestrator/orchestrator'
import BsTile from '../tile'

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
    <span class="text-base inline-block">
      <Show when={type === 'home'}>
        <span class="text-success">↗ Domicile</span>
      </Show>
      <Show when={type === 'outside'}>
        <span class="text-warning">↖ Extérieur</span>
      </Show>
      <Show when={!type}>{'Type non renseigné'}</Show>
    </span>
  )
}

export default function BsMatchTile(props: BsMatchTileProps) {
  const match = props.match
  const team = orchestrator.getTeam(match.teamId)

  return (
    <BsTile
      title={match.opponent || ''}
      badge={<BsMatchTypeText type={match.type} />}
      footer={
        <>
          <Show when={props.onStart}>
            <button
              class="btn btn-secondary btn-square"
              onClick={() => {
                callCallback(match, props?.onStart)
              }}
            >
              <Play />
            </button>
          </Show>

          <Show when={props.onEdit}>
            <button
              class="btn btn-secondary btn-square"
              onClick={() => {
                callCallback(match, props?.onEdit)
              }}
            >
              <FilePenLine />
            </button>
          </Show>

          <button
            class="btn btn-secondary btn-square"
            onClick={() => {
              removeMatch(match)
            }}
          >
            <Trash />
          </button>
        </>
      }
    >
      <Show when={team}>
        <p class="px-4 md:px-5">
          {team?.name} ({team?.playerIds.length})
        </p>
      </Show>
    </BsTile>
  )
}
