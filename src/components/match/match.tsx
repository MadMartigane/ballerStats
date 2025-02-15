import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChartLine,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Eraser,
  Meh,
  MessageSquareWarning,
  Shirt,
  TriangleAlert,
  User,
  Users,
} from 'lucide-solid'
import { For, Show } from 'solid-js'
import { type SetStoreFunction, createStore } from 'solid-js/store'
import MadSignal from '../../libs/mad-signal'
import type Match from '../../libs/match'
import orchestrator from '../../libs/orchestrator/orchestrator'
import type Player from '../../libs/player'
import {
  STATS_MATCH_ACTIONS,
  type StatMatchActionItem,
  type StatMatchSummary,
} from '../../libs/stats'
import { getStatSummary } from '../../libs/stats/stats-util'
import { TEAM_OPPONENT_ID } from '../../libs/team/team'
import { confirmAction, goTo } from '../../libs/utils'
import { vibrate } from '../../libs/vibrator'
import BsScoreCard from '../score-card'
import { BsFullStatTable, BsStatSumUpRebonds } from '../stats'
import type { BsMatchProps } from './match.d'

function openActionMode(
  playerId: string | undefined,
  playerOnAction: MadSignal<string | null>,
) {
  playerOnAction.set(playerId || null)
}

function closeActionMode(playerOnAction: MadSignal<string | null>) {
  playerOnAction.set(null)
}

function registerStat(options: {
  playerId: string | null
  statAction: StatMatchActionItem
  match: Match | null
  statSummary: StatMatchSummary
  setStatSummary: SetStoreFunction<StatMatchSummary>
  disableClearLastAction: MadSignal<boolean>
}) {
  if (!options || !options.match) {
    return
  }

  options.match.stats.push({
    timestamp: Date.now(),
    playerId: options.playerId,
    name: options.statAction.name,
    type: options.statAction.type,
    value: options.statAction.value,
  })

  options.disableClearLastAction.set(options.match.stats.length === 0)
  options.setStatSummary(getStatSummary(options.match))
  orchestrator.Matchs.updateMatch(options.match)
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

function getOutFromPlayground(opts: {
  playerId: string
  playersInTheFive: MadSignal<Array<string>>
  match: Match | null
  statSummary: StatMatchSummary
  setStatSummary: SetStoreFunction<StatMatchSummary>
  disableClearLastAction: MadSignal<boolean>
}) {
  const inTheFive = opts.playersInTheFive.get()

  if (!opts.match || !inTheFive.includes(opts.playerId)) {
    return
  }

  opts.playersInTheFive.set(
    inTheFive.filter(candidateId => candidateId !== opts.playerId),
  )

  opts.match.update({
    playersInTheFive: [...opts.playersInTheFive.get()],
  })
  const statAction = STATS_MATCH_ACTIONS.find(
    candidate => candidate.name === 'fiveOut',
  )
  if (!statAction) {
    throw new Error('Unable to find stat action item: "fiveOut"')
  }

  registerStat({
    playerId: opts.playerId,
    statAction,
    match: opts.match,
    statSummary: opts.statSummary,
    setStatSummary: opts.setStatSummary,
    disableClearLastAction: opts.disableClearLastAction,
  })

  if (opts.playersInTheFive.get().length === 5) {
    vibrate('long')
  } else {
    vibrate()
  }
}

function getInFromPlayground(opts: {
  playerId: string
  playersInTheFive: MadSignal<Array<string>>
  match: Match | null
  statSummary: StatMatchSummary
  setStatSummary: SetStoreFunction<StatMatchSummary>
  disableClearLastAction: MadSignal<boolean>
}) {
  const inTheFive = opts.playersInTheFive.get()

  if (!opts.match || inTheFive.includes(opts.playerId)) {
    return
  }

  /* Do not mutate the current array in order to throw a new render */
  const newFive = Array(...inTheFive)
  newFive.push(opts.playerId)
  opts.playersInTheFive.set(newFive)
  opts.match.update({ playersInTheFive: [...newFive] })

  const statAction = STATS_MATCH_ACTIONS.find(
    candidate => candidate.name === 'fiveIn',
  )
  if (!statAction) {
    throw new Error('Unable to find stat action item: "fiveIn"')
  }

  registerStat({
    playerId: opts.playerId,
    statAction,
    match: opts.match,
    statSummary: opts.statSummary,
    setStatSummary: opts.setStatSummary,
    disableClearLastAction: opts.disableClearLastAction,
  })

  if (opts.playersInTheFive.get().length === 5) {
    vibrate('long')
  } else {
    vibrate()
  }
}

function stopStartTheGame(opts: {
  gameIsPlaying: MadSignal<boolean>
  match: Match | null
  statSummary: StatMatchSummary
  setStatSummary: SetStoreFunction<StatMatchSummary>
  disableClearLastAction: MadSignal<boolean>
}) {
  opts.gameIsPlaying.set(!opts.gameIsPlaying.get())

  const statAction = STATS_MATCH_ACTIONS.find(
    candidate => candidate.name === 'gameStop',
  )
  if (!statAction) {
    throw new Error('Unable to find stat action item: "gameStop"')
  }

  registerStat({
    playerId: null,
    statAction,
    match: opts.match,
    statSummary: opts.statSummary,
    setStatSummary: opts.setStatSummary,
    disableClearLastAction: opts.disableClearLastAction,
  })

  orchestrator.throwUserActionFeedback('long')
}

function renderPlayerBench(opts: {
  player: Player | null
  playersInTheFive: MadSignal<Array<string>>
  match: Match | null
  statSummary: StatMatchSummary
  setStatSummary: SetStoreFunction<StatMatchSummary>
  disableClearLastAction: MadSignal<boolean>
}) {
  if (!opts || !opts.player) {
    return (
      <button type="button" class="btn btn-error btn-disabled w-full">
        Joueur non trouvé
      </button>
    )
  }

  const playerStats = opts.statSummary.players.find(
    stat => stat.playerId === opts.player?.id,
  )

  return (
    <div class="w-full flex flex-row my-3 md:my-4">
      <div class="bg-neutral text-neutral-content w-full rounded-lg border border-primary p-1 flex items-center gap-1">
        <div class="flex-none">
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => {
              getInFromPlayground({
                playerId: opts.player?.id || '',
                playersInTheFive: opts.playersInTheFive,
                match: opts.match,
                statSummary: opts.statSummary,
                setStatSummary: opts.setStatSummary,
                disableClearLastAction: opts.disableClearLastAction,
              })
            }}
          >
            <ArrowUpToLine />
          </button>
          <div class="text-xs text-center">Rentrée</div>
        </div>

        <div class="inline-block flex-none text-center text-3xl">
          <User class="inline-block flex-none" size={28} />
          <div class="inline-block text-3xl flex-auto">
            {opts.player.jersayNumber}
          </div>
        </div>

        <div class="inline-block flex-auto text-center text-3xl">
          {opts.player.nicName ? opts.player.nicName : opts.player.firstName}
        </div>

        <div class="flex flex-col text-center w-8 bg-slate-400/40 rounded-xs">
          <div class="text-success">{playerStats?.scores.total || 0}</div>
          <div class="text-accent-content">
            {playerStats?.rebonds.total || 0}
          </div>
          <div class="text-error">{playerStats?.fouls || 0}</div>
        </div>
      </div>
    </div>
  )
}

function renderPlayerButton(opts: {
  player: Player | null
  match: Match | null
  playerInTheFive: MadSignal<Array<string>>
  statSummary: StatMatchSummary
  setStatSummary: SetStoreFunction<StatMatchSummary>
  disableClearLastAction: MadSignal<boolean>
  matchIsPlaying: MadSignal<boolean>
  playerOnAction: MadSignal<string | null>
}) {
  if (!opts || !opts.player) {
    return (
      <button type="button" class="btn btn-error btn-disabled w-full">
        Joueur non trouvé
      </button>
    )
  }

  if (!opts.match) {
    return (
      <button type="button" class="btn btn-error btn-disabled w-full">
        Match non trouvé
      </button>
    )
  }

  const playerStats = opts.statSummary.players.find(
    stat => stat.playerId === opts.player?.id,
  )

  return (
    <div class="w-full flex flex-row my-3 md:my-4">
      <div class="bg-neutral text-neutral-content w-full rounded-lg border border-primary p-1 flex items-center gap-1">
        <div class="flex-none">
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => {
              getOutFromPlayground({
                playerId: opts.player?.id || '',
                playersInTheFive: opts.playerInTheFive,
                match: opts.match,
                statSummary: opts.statSummary,
                setStatSummary: opts.setStatSummary,
                disableClearLastAction: opts.disableClearLastAction,
              })
            }}
          >
            <ArrowDownToLine />
          </button>
          <div class="text-xs text-center">Sortie</div>
        </div>
        <div class="inline-block flex-auto">
          <div class="flex items-center">
            <User class="inline-block flex-none" size={28} />
            <div class="inline-block text-3xl flex-auto">
              {opts.player.jersayNumber}
            </div>
          </div>
          <div class="text-center text-xl">
            {opts.player.nicName ? opts.player.nicName : opts.player.firstName}
          </div>
        </div>
        <For each={STATS_MATCH_ACTIONS}>
          {statAction => (
            <Show
              when={
                !statAction.secondaryAction &&
                (statAction.everyTimeAction ||
                  (opts.matchIsPlaying.get() && statAction.inGameAction) ||
                  (!opts.matchIsPlaying.get() && !statAction.inGameAction))
              }
            >
              <div class="flex-none hidden md:block">
                <button
                  type="button"
                  class={`btn btn-${statAction.type}`}
                  onClick={() => {
                    registerStat({
                      playerId: opts.player?.id || null,
                      statAction,
                      match: opts.match,
                      statSummary: opts.statSummary,
                      setStatSummary: opts.setStatSummary,
                      disableClearLastAction: opts.disableClearLastAction,
                    })

                    orchestrator.throwUserActionFeedback()
                  }}
                  onKeyDown={() => {
                    registerStat({
                      playerId: opts.player?.id || null,
                      statAction,
                      match: opts.match,
                      statSummary: opts.statSummary,
                      setStatSummary: opts.setStatSummary,
                      disableClearLastAction: opts.disableClearLastAction,
                    })

                    orchestrator.throwUserActionFeedback()
                  }}
                >
                  {statAction.icon(`${statAction.type}-content`)}
                </button>
                <div class="text-xs text-center">{statAction.label1}</div>
              </div>
            </Show>
          )}
        </For>

        <div class="inline-block md:hidden">
          <button
            class="btn w-32"
            type="button"
            onClick={() => {
              openActionMode(opts.player?.id, opts.playerOnAction)
            }}
          >
            Stats !
          </button>
        </div>

        <div class="flex flex-col text-center w-8 bg-slate-400/50 rounded-xs">
          <div class="text-success">{playerStats?.scores.total || 0}</div>
          <div class="text-accent-content">
            {playerStats?.rebonds.total || 0}
          </div>
          <div class="text-error">{playerStats?.fouls || 0}</div>
        </div>
      </div>
    </div>
  )
}

function renderPlayerHeader(playerId: string | null) {
  const player =
    playerId === TEAM_OPPONENT_ID
      ? { nicName: 'Adversaire', firstName: '', jersayNumber: 'XX' }
      : orchestrator.getPlayer(playerId)

  return (
    <div class="w-full my-2 p-3 grid grid-cols-3 gap-3 bg-neutral text-neutral-content rounded-xs">
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

function renderTeamTotals(statSummary: StatMatchSummary) {
  return (
    <div class="overflow-x-auto">
      <div class="stats shadow-xs">
        <div class="stat place-items-center">
          <div class="stat-title">Score</div>
          <div
            class={`stat-value ${statSummary.teamScore > statSummary.opponentScore ? 'text-success' : 'text-warning'}`}
          >
            {statSummary.teamScore}
          </div>
          <div class="stat-desc">{`Score adverse: ${statSummary.opponentScore}`}</div>
        </div>

        <div class="stat place-items-center">
          <div class="stat-title">Fautes</div>
          <div
            class={`stat-value ${statSummary.teamScores.fouls < statSummary.opponentFouls ? 'text-success' : 'text-warning'}`}
          >
            {statSummary.teamScores.fouls}
          </div>
          <div class="stat-desc">{`Fautes adverse: ${statSummary.opponentFouls}`}</div>
        </div>

        <div class="stat place-items-center">
          <div class="stat-title">Balles perdus</div>
          <div class="stat-value text-warning">{statSummary.teamTurnover}</div>
          <div class="stat-desc">Total balles perdus de l’équipe</div>
        </div>

        <div class="stat place-items-center">
          <div class="stat-title">Passe D</div>
          <div class="stat-value text-success">{statSummary.teamAssists}</div>
          <div class="stat-desc">Total des passes décisives de l’équipe</div>
        </div>
      </div>
    </div>
  )
}

function renderStatGrid(statSummary: StatMatchSummary) {
  return (
    <div>
      <BsFullStatTable stats={statSummary} />
      <hr />

      <h3>Totaux de l’équipe:</h3>
      {renderTeamTotals(statSummary)}

      <hr />

      <h3>Synthèse rebonds</h3>
      <BsStatSumUpRebonds stats={statSummary} />
    </div>
  )
}

function renderTheTeamBench(options: {
  sortedPlayers: Array<Player | null>
  playersInTheFive: MadSignal<Array<string>>
  match: Match | null
  statSummary: StatMatchSummary
  setStatSummary: SetStoreFunction<StatMatchSummary>
  disableClearLastAction: MadSignal<boolean>
}) {
  const inTheFive = options.playersInTheFive.get()

  if (inTheFive.length === options.sortedPlayers.length) {
    return (
      <div class="alert alert-info">
        <Meh size={42} />
        <span>Le banc est vide !</span>
      </div>
    )
  }

  return (
    <For each={options.sortedPlayers}>
      {player => (
        <Show
          when={player && !options.playersInTheFive.get().includes(player.id)}
        >
          {renderPlayerBench({
            player,
            playersInTheFive: options.playersInTheFive,
            statSummary: options.statSummary,
            match: options.match,
            setStatSummary: options.setStatSummary,
            disableClearLastAction: options.disableClearLastAction,
          })}
        </Show>
      )}
    </For>
  )
}

function renderTheTeamFive(opts: {
  sortedPlayers: Array<Player | null>
  playersInTheFive: MadSignal<Array<string>>
  match: Match | null
  statSummary: StatMatchSummary
  setStatSummary: SetStoreFunction<StatMatchSummary>
  disableClearLastAction: MadSignal<boolean>
  matchIsPlaying: MadSignal<boolean>
  playerOnAction: MadSignal<string | null>
}) {
  if (opts.playersInTheFive.get().length < 1) {
    return (
      <div class="alert alert-info">
        <MessageSquareWarning size={42} />
        <span>Veuillez sélectionner votre 5 de départ depuis le banc.</span>
      </div>
    )
  }
  return (
    <div
      class={`${opts.playersInTheFive.get().length === 5 ? '' : 'bg-warning/50'} rounded-xs`}
    >
      <For each={opts.sortedPlayers}>
        {player => (
          <Show
            when={player && opts.playersInTheFive.get().includes(player.id)}
          >
            {renderPlayerButton({
              player,
              match: opts.match,
              playerInTheFive: opts.playersInTheFive,
              setStatSummary: opts.setStatSummary,
              disableClearLastAction: opts.disableClearLastAction,
              statSummary: opts.statSummary,
              matchIsPlaying: opts.matchIsPlaying,
              playerOnAction: opts.playerOnAction,
            })}
          </Show>
        )}
      </For>
    </div>
  )
}

export default function BsMatch(props: BsMatchProps) {
  const matchId = props.id
  const match = orchestrator.getMatch(matchId)
  const playerOnAction = new MadSignal(null) as MadSignal<string | null>
  const [statSummary, setStatSummary] = createStore(getStatSummary(match))
  const disableClearLastAction = new MadSignal((match?.stats.length || 0) === 0)
  const isStatMode = new MadSignal(match?.status === 'locked')

  const team = orchestrator.getTeam(match?.teamId)
  const sortedPlayers = orchestrator.getJerseySortedPlayers(team?.playerIds)
  const playersInTheFive = new MadSignal(match?.playersInTheFive || [])
  const matchIsPlaying = new MadSignal(false)

  return (
    <div class="w-full">
      <div class="w-full border border-neutral rounded-xs bg-secondary text-secondary-content">
        <BsScoreCard
          localScore={statSummary.teamScore}
          visitorScore={statSummary.opponentScore}
          location={match?.type}
          localName={team?.name}
          date={match?.date || null}
          visitorName={match?.opponent}
        />
      </div>

      <Show when={!isStatMode.get()}>
        <div class="divider">
          Le 5 (
          <span
            class={
              playersInTheFive.get().length === 5
                ? 'text-success'
                : 'text-error'
            }
          >
            {playersInTheFive.get().length}
          </span>
          )
        </div>
        <Show when={!playerOnAction.get()}>
          <div class="w-full">
            {renderTheTeamFive({
              sortedPlayers,
              playersInTheFive,
              match,
              setStatSummary,
              disableClearLastAction,
              statSummary,
              matchIsPlaying,
              playerOnAction,
            })}

            <hr />

            <div class="w-full flex flex-row my-3 md:my-4">
              <div class="bg-accent text-accent-content w-full rounded-lg border border-primary p-1 flex items-center gap-1">
                <div class="flex-none">
                  <Users size={32} />
                </div>
                <div class="inline-block flex-auto">
                  <div class="text-center text-xl">Équipe adverse</div>
                </div>
                <For each={STATS_MATCH_ACTIONS}>
                  {statAction => (
                    <Show
                      when={
                        !statAction.secondaryAction &&
                        statAction.opponentMatter &&
                        ((matchIsPlaying.get() && statAction.inGameAction) ||
                          (!matchIsPlaying.get() && !statAction.inGameAction))
                      }
                    >
                      <div class="flex-none hidden md:inline-block">
                        <button
                          type="button"
                          class={`btn btn-${statAction.type}`}
                          onClick={() => {
                            registerStat({
                              playerId: TEAM_OPPONENT_ID,
                              statAction,
                              match,
                              statSummary,
                              setStatSummary,
                              disableClearLastAction,
                            })

                            orchestrator.throwUserActionFeedback()
                          }}
                          onKeyDown={() => {
                            registerStat({
                              playerId: TEAM_OPPONENT_ID,
                              statAction,
                              match,
                              statSummary,
                              setStatSummary,
                              disableClearLastAction,
                            })

                            orchestrator.throwUserActionFeedback()
                          }}
                        >
                          {statAction.icon(`${statAction.type}-content`)}
                        </button>
                        <div class="text-xs text-center">
                          {statAction.label1}
                        </div>
                      </div>
                    </Show>
                  )}
                </For>

                <div class="inline-block md:hidden">
                  <button
                    class="btn w-32"
                    type="button"
                    onClick={() => {
                      openActionMode(TEAM_OPPONENT_ID, playerOnAction)
                    }}
                  >
                    Stats !
                  </button>
                </div>

                <div class="flex flex-col text-center w-8 bg-slate-400/50 rounded-xs">
                  <div class="text-success">
                    {statSummary.opponentScore || 0}
                  </div>
                  <div class="text-accent-content">
                    {statSummary.rebonds.opponentTotal || 0}
                  </div>
                  <div class="text-error">{statSummary.opponentFouls || 0}</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              class={`btn btn-lg btn-${matchIsPlaying.get() ? 'error' : 'success'} text-xl w-full`}
              onClick={() =>
                stopStartTheGame({
                  gameIsPlaying: matchIsPlaying,
                  match,
                  setStatSummary,
                  statSummary,
                  disableClearLastAction,
                })
              }
            >
              <Show when={matchIsPlaying.get()}>
                {
                  <>
                    <CirclePause size={32} />
                    Arrêt du jeu
                  </>
                }
              </Show>
              <Show when={!matchIsPlaying.get()}>
                {
                  <>
                    <CirclePlay size={32} />
                    Reprise du jeu
                  </>
                }
              </Show>
            </button>
            <hr />

            <button
              type="button"
              class="btn btn-warning w-full"
              disabled={disableClearLastAction.get()}
              onClick={() => {
                removeLastAction(match, setStatSummary, disableClearLastAction)
              }}
              onKeyDown={(event: KeyboardEvent) => {
                if (event.code === 'Enter') {
                  removeLastAction(
                    match,
                    setStatSummary,
                    disableClearLastAction,
                  )
                }
              }}
            >
              <Eraser />
              Effacer la dernière action
              <TriangleAlert />
            </button>

            <div class="divider">Le Banc</div>
            {renderTheTeamBench({
              sortedPlayers,
              playersInTheFive,
              match,
              setStatSummary,
              statSummary,
              disableClearLastAction,
            })}

            <hr />

            <button
              type="button"
              class="btn btn-primary w-full"
              onClick={() => {
                isStatMode.set(true)
              }}
              onKeyDown={(event: KeyboardEvent) => {
                if (event.code === 'Enter') {
                  isStatMode.set(true)
                }
              }}
            >
              <ChartLine />
              Tableau des stats
              <ChevronRight />
            </button>
          </div>
        </Show>

        <Show when={playerOnAction.get()}>
          {renderPlayerHeader(playerOnAction.get())}
          <div class="w-full py-2 grid grid-cols-2 gap-3">
            <For each={STATS_MATCH_ACTIONS}>
              {item => (
                <Show when={!item.secondaryAction}>
                  <button
                    type="button"
                    class={`btn btn-${item.type}`}
                    onClick={() => {
                      registerStat({
                        playerId: playerOnAction.get(),
                        statAction: item,
                        match,
                        statSummary,
                        setStatSummary,
                        disableClearLastAction,
                      })
                      closeActionMode(playerOnAction)
                    }}
                  >
                    {item.icon(`${item.type}-content`)}
                    <span class="text-2xl">{item.label1}</span>{' '}
                  </button>
                </Show>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={isStatMode.get()}>{renderStatGrid(statSummary)}</Show>

      <hr class="print:hidden"/>

      <button
        type="button"
        class="btn btn-outline w-full print:hidden"
        onClick={event => {
          event.stopPropagation()

          if (match?.status !== 'locked' && isStatMode.get()) {
            isStatMode.set(false)
            return
          }

          if (match?.status !== 'locked' && playerOnAction.get()) {
            closeActionMode(playerOnAction)
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
