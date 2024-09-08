import {
  ChartLine,
  ChevronLeft,
  ChevronRight,
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
import { confirmAction, goTo } from '../../libs/utils'
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

  if (match.status === 'locked') {
    alert('Match vérouillé !!')
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
    <div class="w-full flex flex-row my-3 md:my-4">
      <div
        class="btn btn-primary w-full"
        onClick={() => {
          if (match?.status === 'locked') {
            alert('Match vérouillé !')
            return
          }

          openActionMode(player.id, actionMode)
        }}
      >
        <User size={32} />
        <span class="text-3xl">{player.jersayNumber}</span>
        <span class="inline-block min-w-40 md:min-w-72 text-3xl">
          {player.nicName ? player.nicName : player.firstName}
        </span>
        <span class="inline-block w-5 text-success text-xl">
          {statSummary.players[player.id]?.scores.total || 0}
        </span>
        <span class="inline-block w-5 text-accent-content text-xl">
          {statSummary.players[player.id]?.rebonds.total || 0}
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

function renderStatGrid(statSummary: StatMatchSummary) {
  return (
    <div>
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr>
              <th>
                <Shirt />
              </th>
              <th>Nom</th>
              <th>Pts</th>
              <th>Rbs (O-D)</th>
              <th>Fautes</th>
              <th>LF</th>
              <th>2pts</th>
              <th>3pts</th>
            </tr>
          </thead>
          <tbody>
            <For each={Object.keys(statSummary.players)}>
              {playerId => {
                const player = orchestrator.getPlayer(playerId)

                return (
                  <tr>
                    <th>
                      <span class="text-2xl">{player?.jersayNumber}</span>
                    </th>
                    <td>
                      {player?.nicName ? player.nicName : player?.firstName}
                    </td>
                    <td>
                      <span class="text-lg">{`${statSummary.players[playerId].scores.total}`}</span>
                    </td>
                    <td>
                      <span class="text-lg">{`${statSummary.players[playerId].rebonds.total}`}</span>
                      <span class="">{` (${statSummary.players[playerId].rebonds.offensive}-${statSummary.players[playerId].rebonds.defensive})`}</span>
                    </td>
                    <td>
                      <span class="text-lg">{`${statSummary.players[playerId].fouls}`}</span>
                    </td>
                    <td>
                      <span class="text-lg">{`${statSummary.players[playerId].scores['free-throw']}`}</span>
                      {` ${statSummary.players[playerId].ratio['free-throw'].success}/${statSummary.players[playerId].ratio['free-throw'].total}`}
                      {` (${statSummary.players[playerId].ratio['free-throw'].percentage}%)`}
                    </td>
                    <td>
                      <span class="text-lg">{`${statSummary.players[playerId].scores['2pts']}`}</span>
                      {` ${statSummary.players[playerId].ratio['2pts'].success}/${statSummary.players[playerId].ratio['2pts'].total}`}
                      {` (${statSummary.players[playerId].ratio['2pts'].percentage}%)`}
                    </td>
                    <td>
                      <span class="text-lg">{`${statSummary.players[playerId].scores['3pts']}`}</span>
                      {` ${statSummary.players[playerId].ratio['3pts'].success}/${statSummary.players[playerId].ratio['3pts'].total}`}
                      {` (${statSummary.players[playerId].ratio['3pts'].percentage}%)`}
                    </td>
                  </tr>
                )
              }}
            </For>
          </tbody>
        </table>
      </div>

      <hr />

      <h3>Synthèse rebonds</h3>
      <div class="stats shadow">
        <div class="stat place-items-center">
          <div class="stat-title">Total</div>
          <div
            class={`stat-value ${statSummary.rebonds.teamTotalPercentage > 49 ? 'text-success' : 'text-warning'}`}
          >{`${statSummary.rebonds.teamTotalPercentage} %`}</div>
          <div class="stat-desc">{`Équipe (${statSummary.rebonds.teamTotal}) - Opposent (${statSummary.rebonds.opponentTotal})`}</div>
        </div>

        <div class="stat place-items-center">
          <div class="stat-title">Offensifs</div>
          <div
            class={`stat-value ${statSummary.rebonds.teamOffensivePercentage > 49 ? 'text-success' : 'text-warning'}`}
          >{`${statSummary.rebonds.teamOffensivePercentage} %`}</div>
          <div class="stat-desc">{`Équipe (${statSummary.rebonds.teamOffensive}) - Opposent (${statSummary.rebonds.opponentOffensive})`}</div>
        </div>

        <div class="stat place-items-center">
          <div class="stat-title">Defensifs</div>
          <div
            class={`stat-value ${statSummary.rebonds.teamDefensivePercentage > 49 ? 'text-success' : 'text-warning'}`}
          >{`${statSummary.rebonds.teamDefensivePercentage} %`}</div>
          <div class="stat-desc">{`Équipe (${statSummary.rebonds.teamDefensive}) - Opposent (${statSummary.rebonds.opponentDefensive})`}</div>
        </div>
      </div>
    </div>
  )
}

export default function BsMatch(props: BsMatchProps) {
  const matchId = props.id
  const match = orchestrator.getMatch(matchId)
  const actionMode = new MadSignal(null) as MadSignal<string | null>
  const [statSummary, setStatSummary] = createStore(getStatSummary(match))
  const disableClearLastAction = new MadSignal((match?.stats.length || 0) === 0)
  const isStatMode = new MadSignal(match?.status === 'locked')

  const team = orchestrator.getTeam(match?.teamId)
  const sortedPlayers = orchestrator.getJerseySortedPlayers(team?.playerIds)

  return (
    <div class="w-full">
      <div class="w-full border border-neutral rounded bg-secondary text-secondary-content">
        <BsScoreCard
          localScore={statSummary.localScore}
          visitorScore={statSummary.opponentScore}
          location={match?.type}
          localName={team?.name}
          visitorName={match?.opponent}
        />
      </div>

      <Show when={!isStatMode.get()}>
        <Show when={!actionMode.get()}>
          <div class="w-full py-3">
            <For each={sortedPlayers}>
              {player =>
                renderPlayerButton(player, match, actionMode, statSummary)
              }
            </For>

            <button
              class="btn btn-accent w-full my-4"
              onClick={() => {
                if (match?.status === 'locked') {
                  alert('Match vérouillé !')
                  return
                }

                openActionMode(TEAM_OPPONENT_ID, actionMode)
              }}
            >
              <Users size={32} />
              <span class="inline-block w-44 text-lg">Équipe adverse</span>
              <span class="inline-block w-5 text-success text-xl">
                {statSummary.opponentScore || 0}
              </span>
              <span class="inline-block w-5 text-accent-content text-xl">
                {statSummary.rebonds.opponentTotal || 0}
              </span>
              <span class="inline-block w-5 text-warning text-xl">
                {statSummary.opponentFouls || 0}
              </span>
            </button>

            <button
              class="btn btn-primary w-full"
              onClick={() => {
                isStatMode.set(true)
              }}
            >
              <ChartLine />
              Tableau des stats
              <ChevronRight />
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
      </Show>

      <Show when={isStatMode.get()}>{renderStatGrid(statSummary)}</Show>

      <hr />
      {/* CANCEL ACTION */}
      <button
        class="btn btn-outline w-full"
        onClick={event => {
          event.stopPropagation()

          if (match?.status !== 'locked' && isStatMode.get()) {
            isStatMode.set(false)
            return
          }

          if (match?.status !== 'locked' && actionMode.get()) {
            closeActionMode(actionMode)
            return
          }

          goTo('matchs')
        }}
      >
        <ChevronLeft />
        <span>Retour</span>
      </button>
    </div>
  )
}
