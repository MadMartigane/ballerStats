import { FilePenLine, Lock, LockOpen, Trash } from 'lucide-solid'
import { Show } from 'solid-js'
import type Match from '../../libs/match'
import orchestrator from '../../libs/orchestrator/orchestrator'
import { confirmAction, toDateTime } from '../../libs/utils'
import BsTile from '../tile'
import type { BsMatchTileProps, BsMatchTypeProps } from './match-tile.d'

async function removeMatch(match: Match) {
  const yes = await confirmAction()

  if (yes) {
    orchestrator.Matchs.remove(match)
  }
}

function callCallback(match: Match, callback?: (match: Match) => void) {
  if (!callback) {
    return
  }

  callback(match)
}

export function BsMatchTypeText(props: BsMatchTypeProps) {
  const type = props.type
  const size = props.size || 'base'

  if (!type) {
    return <></>
  }

  return (
    <span class={`text-${size} inline-block`}>
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

export function BsMatchTypeBadge(props: BsMatchTypeProps) {
  const type = props.type
  const size = props.size || 'base'

  if (!type) {
    return <></>
  }

  return (
    <div class={`badge badge-${type === 'home' ? 'success' : 'warning'} text-${size} py-4 px-2 rounded-md`}>
      {type === 'home' ? '↗ Domicile' : '↖ Extérieur'}
    </div>
  )
}

export default function BsMatchTile(props: BsMatchTileProps) {
  const match = props.match
  const team = orchestrator.getTeam(match.teamId)

  return (
    <BsTile
      title={match.opponent || ''}
      onClick={() => {
        callCallback(match, props?.onStart)
      }}
      status={
        <>
          <div class="float-left">{toDateTime(match?.date)}</div>
          <div class="float-right">
            <Show
              when={match.status === 'locked'}
              fallback={
                <div class="badge badge-success p-2 rounded-lg">
                  <LockOpen size={18} />
                </div>
              }
            >
              <div class="badge badge-warning p-2 rounded-lg">
                <Lock size={18} />
              </div>
            </Show>
          </div>
        </>
      }
      badge={<BsMatchTypeText type={match.type} />}
      footer={
        <>
          <Show when={props.onEdit}>
            <button
              class="btn btn-secondary btn-square"
              onClick={(event) => {
                event.stopPropagation()
                callCallback(match, props?.onEdit)
              }}
            >
              <FilePenLine />
            </button>
          </Show>

          <button
            class="btn btn-secondary btn-square"
            onClick={(event) => {
              event.stopPropagation()
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
