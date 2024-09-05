import {
  ChevronLeft,
  Eraser,
  Shirt,
  TriangleAlert,
  User,
  Users,
} from 'lucide-solid'
import { For, Show } from 'solid-js'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import {
  StatMatchActionItem,
  StatMatchSummary,
  STATS_MATCH_ACTIONS,
} from '../../libs/stats'
import { TEAM_OPPONENT_ID } from '../../libs/team/team'
import BsScoreCard from '../score-card'
import { BsMatchProps } from './match.d'
import Match from '../../libs/match'
import { createStore, SetStoreFunction } from 'solid-js/store'
import { getStatSummary } from '../../libs/stats/stats-util'
import { confirmAction, goBack } from '../../libs/utils'
import Player from '../../libs/player'

function openActionMode(
  playerId: string,
  actionMode: MadSignal<string | null>,
) {
  actionMode.set(playerId)
}

function closeActionMode(actionMode: MadSignal<string | null>) {
  actionMode.set(null)
}

function registerStat(
  playerId: string | null,
  item: StatMatchActionItem,
  match: Match | null,
  setStatSummary: SetStoreFunction<StatMatchSummary>,
  disableClearLastAction: MadSignal<boolean>,
) {
  if (!playerId || !match) {
    return
  }

  match.stats.push({
    playerId,
    name: item.name,
    type: item.type,
    value: item.value,
  })

  disableClearLastAction.set(match.stats.length === 0)
  setStatSummary(getStatSummary(match))
  orchestrator.Matchs.updateMatch(match)
}

async function removeAction(
  match: Match | null,
  id: number,
  setStatSummary: SetStoreFunction<StatMatchSummary>,
  disableClearLastAction: MadSignal<boolean>,
) {
  if (!match) {
    return
  }

  const maxId = match.stats.length - 1

  if (id < 0 || id > maxId) {
    throw new Error(`Unable to remove action id ${id}: nim 0, max: ${maxId}`)
  }

  const confirm = await confirmAction()
  if (!confirm) {
    return
  }

  match.stats.splice(id, 1)

  disableClearLastAction.set(match.stats.length === 0)
  setStatSummary(getStatSummary(match))
  orchestrator.Matchs.updateMatch(match)
}

async function removeLastAction(
  match: Match | null,
  setStatSummary: SetStoreFunction<StatMatchSummary>,
  disableClearLastAction: MadSignal<boolean>,
) {
  if (!match) {
    return
  }

  return removeAction(
    match,
    match.stats.length - 1,
    setStatSummary,
    disableClearLastAction,
  )
}

function renderPlayerButton(
  player: Player | null,
  match: Match | null,
  actionMode: MadSignal<string | null>,
  statSummary: StatMatchSummary,
) {
  if (!player) {
    return (
      <button class="btn btn-error btn-disabled w-full">{`Joueur non trouvé`}</button>
    )
  }

  if (!match) {
    return (
      <button class="btn btn-error btn-disabled w-full">{`Match non trouvé`}</button>
    )
  }

  return (
    <div class="w-full flex flex-row my-2">
      <div
        class="btn btn-primary w-full"
        onClick={() => {
          openActionMode(player.id, actionMode)
        }}
      >
        <User size={32} />
        <span class="text-3xl">{player.jersayNumber}</span>
        <span class="inline-block w-32">
          {player.nicName ? player.nicName : player.firstName}
        </span>
        <span class="inline-block w-5 text-success text-xl">
          {statSummary.players[player.id]?.score || 0}
        </span>
        <span class="inline-block w-5 text-accent-content text-xl">
          {statSummary.players[player.id]?.rebonds || 0}
        </span>
        <span class="inline-block w-5 text-warning text-xl">
          {statSummary.players[player.id]?.fouls || 0}
        </span>
      </div>
    </div>
  )
}

function renderPlayerHeader(playerId: string | null) {
  const player = orchestrator.getPlayer(playerId)

  return (
    <div class="w-full my-2 p-3 grid grid-cols-3 gap-3 bg-primary text-primary-content rounded">
      <div>
        <Shirt size={28} />
      </div>
      <div class="text-center">
        <div class="text-xl">
          {player?.nicName ? player.nicName : player?.firstName}
        </div>
        <div class="text-sm">Action</div>
      </div>
      <div class="text-3xl text-right">{player?.jersayNumber}</div>
    </div>
  )
}

export default function BsMatch(props: BsMatchProps) {
  const matchId = props.id
  const match = orchestrator.getMatch(matchId)
  const actionMode = new MadSignal(null) as MadSignal<string | null>
  const [statSummary, setStatSummary] = createStore(getStatSummary(match))
  const disableClearLastAction = new MadSignal((match?.stats.length || 0) === 0)

  const team = orchestrator.getTeam(match?.teamId)
  const sortedPlayers = orchestrator.getJerseySortedPlayers(team?.playerIds)

  return (
    <div class="w-full">
      <div class="w-full border border-neutral rounded bg-secondary text-secondary-content">
        <BsScoreCard
          localScore={statSummary.localScore}
          visitorScore={statSummary.opponentScore}
        />
      </div>

      <Show when={!actionMode.get()}>
        <div class="w-full py-3">
          <For each={sortedPlayers}>
            {player =>
              renderPlayerButton(player, match, actionMode, statSummary)
            }
          </For>

          <button
            class="btn btn-accent w-full"
            onClick={() => {
              openActionMode(TEAM_OPPONENT_ID, actionMode)
            }}
          >
            <Users size={32} />
            <span class="inline-block w-44 text-lg">Équipe adverse</span>
            <span class="inline-block w-5 text-success text-xl">
              {statSummary.opponentScore || 0}
            </span>
            <span class="inline-block w-5 text-accent-content text-xl">
              {statSummary.opponentRebonds || 0}
            </span>
            <span class="inline-block w-5 text-warning text-xl">
              {statSummary.opponentFouls || 0}
            </span>
          </button>

          <hr />

          <button
            class="btn btn-warning w-full"
            disabled={disableClearLastAction.get()}
            onClick={() => {
              removeLastAction(match, setStatSummary, disableClearLastAction)
            }}
          >
            <Eraser />
            Effacer la dernière action
            <TriangleAlert />
          </button>
        </div>
      </Show>

      <Show when={actionMode.get()}>
        {renderPlayerHeader(actionMode.get())}
        <div class="w-full py-2 grid grid-cols-2 gap-3">
          <For each={STATS_MATCH_ACTIONS}>
            {item => (
              <button
                class={`btn btn-${item.type}`}
                onClick={() => {
                  registerStat(
                    actionMode.get(),
                    item,
                    match,
                    setStatSummary,
                    disableClearLastAction,
                  )
                  closeActionMode(actionMode)
                }}
              >
                {item.icon}
                <span class="text-2xl">{item.label1}</span>{' '}
                <span>{item.label2}</span>
              </button>
            )}
          </For>
        </div>
      </Show>

      <hr />
      {/* CANCEL ACTION */}
      <button
        class="btn btn-outline w-full"
        onClick={() => {
          actionMode.get() ? closeActionMode(actionMode) : goBack()
        }}
      >
        <ChevronLeft />
        <span>Retour</span>
      </button>
    </div>
  )
}
