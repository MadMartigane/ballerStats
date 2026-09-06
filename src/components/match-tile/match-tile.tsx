import { FilePenLine, Frown, Lock, LockOpen, Trash, Trophy } from 'lucide-solid'
import { createMemo, Show } from 'solid-js'
import type Match from '../../libs/match/match'
import orchestrator from '../../libs/orchestrator/orchestrator'
import { getMatchOutcome, type MatchOutcome } from '../../libs/stats/stats-util'
import { removeMatch as removeStoredMatch } from '../../libs/stores/matchs-store'
import { confirmAction, toDateTime } from '../../libs/utils/utils'
import BsTile from '../tile/tile'
import type { BsMatchTileProps, BsMatchTypeProps } from './match-tile.d'

const MATCH_OUTCOME_LABELS = {
  loss: 'Défaite',
  win: 'Victoire',
} as const

async function removeMatch(match: Match) {
  const yes = await confirmAction()

  if (yes) {
    removeStoredMatch(match.id)
  }
}

function callCallback(match: Match, callback?: (match: Match) => void) {
  if (!callback) {
    return
  }

  callback(match)
}

function makeEditMatchClickHandler(match: Match, onEdit?: BsMatchTileProps['onEdit']) {
  return (event: MouseEvent) => {
    event.stopPropagation()
    callCallback(match, onEdit)
  }
}

function makeRemoveMatchClickHandler(match: Match) {
  return (event: MouseEvent) => {
    event.stopPropagation()
    removeMatch(match)
  }
}

function makeStartMatchClickHandler(match: Match, onStart?: BsMatchTileProps['onStart']) {
  return () => {
    callCallback(match, onStart)
  }
}

export function BsMatchTypeText(props: BsMatchTypeProps) {
  const { size = 'base', type } = props

  if (!type) {
    return null
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
  const { size = 'base', type } = props

  if (!type) {
    return null
  }

  return (
    <div class={`badge badge-${type === 'home' ? 'success' : 'warning'} text-${size} rounded-md px-2 py-4`}>
      {type === 'home' ? '↗ Domicile' : '↖ Extérieur'}
    </div>
  )
}

export default function BsMatchTile(props: BsMatchTileProps) {
  const { match } = props
  const team = orchestrator.getTeam(match.teamId)
  const editMatchLabel = 'Modifier le match'
  const deleteMatchLabel = 'Supprimer le match'
  const outcome = createMemo(() => getMatchOutcome(props.match))
  const hasStats = createMemo(() => outcome().result !== 'none')
  const result = () => outcome().result
  const isWin = createMemo(() => result() === 'win')
  const isLoss = createMemo(() => result() === 'loss')
  const hasResult = createMemo(() => result() !== 'none' && result() !== 'tie')

  const BORDER_CLASS: Record<MatchOutcome, string> = {
    loss: 'border-l-4 border-l-error',
    none: '',
    tie: '',
    win: 'border-l-4 border-l-success',
  }

  const SCORE_CLASS: Record<MatchOutcome, string> = {
    loss: 'text-error',
    none: '',
    tie: '',
    win: 'text-success',
  }

  const borderClass = createMemo(() => BORDER_CLASS[result()])
  const teamScoreClass = createMemo(() => SCORE_CLASS[result()])

  return (
    <div class={borderClass()}>
      <BsTile
        badge={<BsMatchTypeText type={match.type} />}
        body={
          <Show when={hasStats()}>
            <div class="my-2 flex items-center justify-center gap-2 text-lg">
              <span class="font-semibold">{team?.name}</span>
              <span class={`font-bold font-mono tabular-nums ${teamScoreClass()}`}>{outcome().teamScore}</span>
              <span class="opacity-60">—</span>
              <span class="font-bold font-mono tabular-nums">{outcome().opponentScore}</span>
              <span class="font-semibold">{props.match.opponent}</span>
            </div>
          </Show>
        }
        footer={
          <>
            <Show when={props.onEdit}>
              <div class="tooltip tooltip-top" data-tip={editMatchLabel}>
                <button
                  aria-label={editMatchLabel}
                  class="btn btn-secondary btn-square"
                  onClick={makeEditMatchClickHandler(match, props?.onEdit)}
                  type="button"
                >
                  <FilePenLine />
                </button>
              </div>
            </Show>

            <div class="tooltip tooltip-top" data-tip={deleteMatchLabel}>
              <button
                aria-label={deleteMatchLabel}
                class="btn btn-secondary btn-square"
                onClick={makeRemoveMatchClickHandler(match)}
                type="button"
              >
                <Trash />
              </button>
            </div>
          </>
        }
        header={
          <Show when={hasResult()}>
            <div class={`badge badge-soft ${isLoss() ? 'badge-error' : 'badge-success'} gap-1`}>
              {isWin() ? <Trophy size={16} /> : <Frown size={16} />}
              {isWin() ? MATCH_OUTCOME_LABELS.win : MATCH_OUTCOME_LABELS.loss}
            </div>
          </Show>
        }
        onClick={makeStartMatchClickHandler(match, props?.onStart)}
        status={
          <div class="flex items-center justify-between gap-1">
            <div class="text-sm">{toDateTime(props.match.date)}</div>
            <Show when={props.match.championship}>
              <div class="badge badge-ghost badge-sm max-w-[50%] truncate">{props.match.championship}</div>
            </Show>
            <Show
              fallback={
                <div class="badge badge-success rounded-lg p-2">
                  <LockOpen size={18} />
                </div>
              }
              when={props.match.status === 'locked'}
            >
              <div class="badge badge-warning rounded-lg p-2">
                <Lock size={18} />
              </div>
            </Show>
          </div>
        }
        title={match.opponent || ''}
      >
        <Show when={team && !hasStats()}>
          <p class="px-4 md:px-5">
            {team?.name} ({team?.playerIds.length})
          </p>
        </Show>
      </BsTile>
    </div>
  )
}
