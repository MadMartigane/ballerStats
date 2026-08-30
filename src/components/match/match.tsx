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
import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'
import { canManageStaff, currentRole, currentUser, isLoggedIn } from '../../libs/auth/auth'
import {
  acquireMatchLease,
  getLeaseHolderFromError,
  isLeaseHeldError,
  LEASE_HEARTBEAT_MS,
  leaseStateForMe,
  releaseMatchLease,
} from '../../libs/lease/lease'
import type { LeaseHolder, LeaseStateForMe } from '../../libs/lease/lease.d'
import MadSignal from '../../libs/mad-signal'
import type Match from '../../libs/match/match'
import orchestrator from '../../libs/orchestrator/orchestrator'
import type Player from '../../libs/player/player'
import { isAuthEnabled } from '../../libs/pocketbase/client'
import { STATS_MATCH_ACTIONS } from '../../libs/stats/stats'
import type { StatMatchActionItem, StatMatchSummary } from '../../libs/stats/stats.d'
import { getStatSummary } from '../../libs/stats/stats-util'
import { TEAM_OPPONENT_ID } from '../../libs/team/team'
import { confirmAction, goTo, toast } from '../../libs/utils/utils'
import { vibrate } from '../../libs/vibrator/vibrator'
import BsScoreCard from '../score-card/score-card'
import { BsFullStatTable } from '../stats/full-stat-table'
import { BsStatSumUpRebonds } from '../stats/sum-up-rebonds'
import BsLeaseBanner from './lease-banner'
import type { BsMatchProps } from './match.d'

function openActionMode(playerId: string | undefined, playerOnAction: MadSignal<string | null>) {
  playerOnAction.set(playerId || null)
}

function closeActionMode(playerOnAction: MadSignal<string | null>) {
  playerOnAction.set(null)
}

/** Count on-court ids that still resolve to a live player (tombstoned/missing excluded). */
function countLiveInFive(playerIds: string[]): number {
  return playerIds.filter((playerId) => orchestrator.getPlayer(playerId)).length
}

function registerStat(options: {
  playerId: string | null
  statAction: StatMatchActionItem
  match: Match | null
  statSummary: StatMatchSummary
  setStatSummary: SetStoreFunction<StatMatchSummary>
  disableClearLastAction: MadSignal<boolean>
}) {
  if (!options.match) {
    return
  }

  options.match.stats.push({
    name: options.statAction.name,
    playerId: options.playerId,
    timestamp: Date.now(),
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
  disableClearLastAction: MadSignal<boolean>
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

function removeLastAction(
  match: Match | null,
  setStatSummary: SetStoreFunction<StatMatchSummary>,
  disableClearLastAction: MadSignal<boolean>
) {
  if (!match) {
    return
  }

  if (match.status === 'locked') {
    toast('Match verrouillé !!', 'warning')
    return
  }

  return removeAction(match, match.stats.length - 1, setStatSummary, disableClearLastAction)
}

function getOutFromPlayground(opts: {
  playerId: string
  playersInTheFive: MadSignal<string[]>
  match: Match | null
  statSummary: StatMatchSummary
  setStatSummary: SetStoreFunction<StatMatchSummary>
  disableClearLastAction: MadSignal<boolean>
}) {
  const inTheFive = opts.playersInTheFive.get()

  if (!opts.match || !inTheFive.includes(opts.playerId)) {
    return
  }

  opts.playersInTheFive.set(inTheFive.filter((candidateId) => candidateId !== opts.playerId))

  opts.match.update({
    playersInTheFive: [...opts.playersInTheFive.get()],
  })
  const statAction = STATS_MATCH_ACTIONS.find((candidate) => candidate.name === 'fiveOut')
  if (!statAction) {
    throw new Error('Unable to find stat action item: "fiveOut"')
  }

  registerStat({
    disableClearLastAction: opts.disableClearLastAction,
    match: opts.match,
    playerId: opts.playerId,
    setStatSummary: opts.setStatSummary,
    statAction,
    statSummary: opts.statSummary,
  })

  if (opts.playersInTheFive.get().length === 5) {
    vibrate('long')
  } else {
    vibrate()
  }
}

function getInFromPlayground(opts: {
  playerId: string
  playersInTheFive: MadSignal<string[]>
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
  const newFive = [...inTheFive]
  newFive.push(opts.playerId)
  opts.playersInTheFive.set(newFive)
  opts.match.update({ playersInTheFive: [...newFive] })

  const statAction = STATS_MATCH_ACTIONS.find((candidate) => candidate.name === 'fiveIn')
  if (!statAction) {
    throw new Error('Unable to find stat action item: "fiveIn"')
  }

  registerStat({
    disableClearLastAction: opts.disableClearLastAction,
    match: opts.match,
    playerId: opts.playerId,
    setStatSummary: opts.setStatSummary,
    statAction,
    statSummary: opts.statSummary,
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

  const statAction = STATS_MATCH_ACTIONS.find((candidate) => candidate.name === 'gameStop')
  if (!statAction) {
    throw new Error('Unable to find stat action item: "gameStop"')
  }

  registerStat({
    disableClearLastAction: opts.disableClearLastAction,
    match: opts.match,
    playerId: null,
    setStatSummary: opts.setStatSummary,
    statAction,
    statSummary: opts.statSummary,
  })

  orchestrator.throwUserActionFeedback('long')
}

interface StatRegistrationContext {
  disableClearLastAction: MadSignal<boolean>
  match: Match | null
  setStatSummary: SetStoreFunction<StatMatchSummary>
  statSummary: StatMatchSummary
}

/** Scoring-lease state from the perspective of the live scoring screen. */
type LeaseUiState = LeaseStateForMe | 'offline' | 'unknown'

interface PlayerBenchRenderOptions extends StatRegistrationContext {
  player: Player | null
  playersInTheFive: MadSignal<string[]>
}

interface PlayerButtonRenderOptions extends StatRegistrationContext {
  matchIsPlaying: MadSignal<boolean>
  player: Player | null
  playerInTheFive: MadSignal<string[]>
  playerOnAction: MadSignal<string | null>
}

function makePlayerBenchInClickHandler(opts: PlayerBenchRenderOptions) {
  return () => {
    getInFromPlayground({
      disableClearLastAction: opts.disableClearLastAction,
      match: opts.match,
      playerId: opts.player?.id || '',
      playersInTheFive: opts.playersInTheFive,
      setStatSummary: opts.setStatSummary,
      statSummary: opts.statSummary,
    })
  }
}

function makePlayerButtonOutClickHandler(opts: PlayerButtonRenderOptions) {
  return () => {
    getOutFromPlayground({
      disableClearLastAction: opts.disableClearLastAction,
      match: opts.match,
      playerId: opts.player?.id || '',
      playersInTheFive: opts.playerInTheFive,
      setStatSummary: opts.setStatSummary,
      statSummary: opts.statSummary,
    })
  }
}

function makePlayerButtonRegisterStatHandler(opts: PlayerButtonRenderOptions, statAction: StatMatchActionItem) {
  return () => {
    registerStat({
      disableClearLastAction: opts.disableClearLastAction,
      match: opts.match,
      playerId: opts.player?.id || null,
      setStatSummary: opts.setStatSummary,
      statAction,
      statSummary: opts.statSummary,
    })

    orchestrator.throwUserActionFeedback()
  }
}

function makePlayerActionModeClickHandler(player: Player | null, playerOnAction: MadSignal<string | null>) {
  return () => {
    openActionMode(player?.id, playerOnAction)
  }
}

function makeOpponentRegisterStatHandler(options: {
  disableClearLastAction: MadSignal<boolean>
  match: Match | null
  setStatSummary: SetStoreFunction<StatMatchSummary>
  statAction: StatMatchActionItem
  statSummary: StatMatchSummary
}) {
  return () => {
    registerStat({
      disableClearLastAction: options.disableClearLastAction,
      match: options.match,
      playerId: TEAM_OPPONENT_ID,
      setStatSummary: options.setStatSummary,
      statAction: options.statAction,
      statSummary: options.statSummary,
    })

    orchestrator.throwUserActionFeedback()
  }
}

function makeOpponentActionModeClickHandler(playerOnAction: MadSignal<string | null>) {
  return () => {
    openActionMode(TEAM_OPPONENT_ID, playerOnAction)
  }
}

function makeStopStartGameClickHandler(options: {
  disableClearLastAction: MadSignal<boolean>
  gameIsPlaying: MadSignal<boolean>
  match: Match | null
  setStatSummary: SetStoreFunction<StatMatchSummary>
  statSummary: StatMatchSummary
}) {
  return () => {
    stopStartTheGame(options)
  }
}

function makeRemoveLastActionClickHandler(
  match: Match | null,
  setStatSummary: SetStoreFunction<StatMatchSummary>,
  disableClearLastAction: MadSignal<boolean>
) {
  return () => {
    removeLastAction(match, setStatSummary, disableClearLastAction)
  }
}

function makeRemoveLastActionKeyDownHandler(
  match: Match | null,
  setStatSummary: SetStoreFunction<StatMatchSummary>,
  disableClearLastAction: MadSignal<boolean>
) {
  return (event: KeyboardEvent) => {
    if (event.code === 'Enter') {
      removeLastAction(match, setStatSummary, disableClearLastAction)
    }
  }
}

function makeOpenStatModeClickHandler(isStatMode: MadSignal<boolean>) {
  return () => {
    isStatMode.set(true)
  }
}

function makeOpenStatModeKeyDownHandler(isStatMode: MadSignal<boolean>) {
  return (event: KeyboardEvent) => {
    if (event.code === 'Enter') {
      isStatMode.set(true)
    }
  }
}

function makePlayerOnActionStatClickHandler(
  options: {
    disableClearLastAction: MadSignal<boolean>
    match: Match | null
    setStatSummary: SetStoreFunction<StatMatchSummary>
    statSummary: StatMatchSummary
  },
  statAction: StatMatchActionItem,
  playerOnAction: MadSignal<string | null>
) {
  return () => {
    registerStat({
      disableClearLastAction: options.disableClearLastAction,
      match: options.match,
      playerId: playerOnAction.get(),
      setStatSummary: options.setStatSummary,
      statAction,
      statSummary: options.statSummary,
    })
    closeActionMode(playerOnAction)
  }
}

function makeBackClickHandler(
  match: Match | null,
  isStatMode: MadSignal<boolean>,
  playerOnAction: MadSignal<string | null>
) {
  return (event: MouseEvent) => {
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
  }
}

function renderPlayerBench(opts: PlayerBenchRenderOptions) {
  if (!opts.player) {
    return (
      <button class="btn btn-error btn-disabled w-full" type="button">
        Joueur non trouvé
      </button>
    )
  }

  const playerStats = opts.statSummary.players.find((stat) => stat.playerId === opts.player?.id)

  return (
    <div class="my-3 flex w-full flex-row md:my-4">
      <div class="flex w-full items-center gap-1 rounded-lg border border-primary bg-neutral p-1 text-neutral-content">
        <div class="flex-none">
          <button class="btn btn-primary" onClick={makePlayerBenchInClickHandler(opts)} type="button">
            <ArrowUpToLine />
          </button>
          <div class="text-center text-xs">Rentrée</div>
        </div>

        <div class="inline-block flex-none text-center text-3xl">
          <User class="inline-block flex-none" size={28} />
          <div class="inline-block flex-auto text-3xl">{opts.player.jerseyNumber}</div>
        </div>

        <div class="inline-block flex-auto text-center text-3xl">
          {opts.player.nicName ? opts.player.nicName : opts.player.firstName}
        </div>

        <div class="flex w-8 flex-col rounded-xs bg-slate-400/40 text-center">
          <div class="text-success">{playerStats?.scores.total || 0}</div>
          <div class="text-accent-content">{playerStats?.rebonds.total || 0}</div>
          <div class="text-error">{playerStats?.fouls || 0}</div>
        </div>
      </div>
    </div>
  )
}

function renderPlayerButton(opts: PlayerButtonRenderOptions) {
  if (!opts.player) {
    return (
      <button class="btn btn-error btn-disabled w-full" type="button">
        Joueur non trouvé
      </button>
    )
  }

  if (!opts.match) {
    return (
      <button class="btn btn-error btn-disabled w-full" type="button">
        Match non trouvé
      </button>
    )
  }

  const playerStats = opts.statSummary.players.find((stat) => stat.playerId === opts.player?.id)

  return (
    <div class="my-3 flex w-full flex-row md:my-4">
      <div class="flex w-full items-center gap-1 rounded-lg border border-primary bg-neutral p-1 text-neutral-content">
        <div class="flex-none">
          <button class="btn btn-primary" onClick={makePlayerButtonOutClickHandler(opts)} type="button">
            <ArrowDownToLine />
          </button>
          <div class="text-center text-xs">Sortie</div>
        </div>
        <div class="inline-block flex-auto">
          <div class="flex items-center">
            <User class="inline-block flex-none" size={28} />
            <div class="inline-block flex-auto text-3xl">{opts.player.jerseyNumber}</div>
          </div>
          <div class="text-center text-xl">{opts.player.nicName ? opts.player.nicName : opts.player.firstName}</div>
        </div>
        <For each={STATS_MATCH_ACTIONS}>
          {(statAction) => (
            <Show
              when={
                !statAction.secondaryAction &&
                (statAction.everyTimeAction ||
                  (opts.matchIsPlaying.get() && statAction.inGameAction) ||
                  (!opts.matchIsPlaying.get() && !statAction.inGameAction))
              }
            >
              <div class="hidden flex-none md:block">
                <button
                  class={`btn btn-${statAction.type}`}
                  onClick={makePlayerButtonRegisterStatHandler(opts, statAction)}
                  onKeyDown={makePlayerButtonRegisterStatHandler(opts, statAction)}
                  type="button"
                >
                  {statAction.icon()}
                </button>
                <div class="text-center text-xs">{statAction.label1}</div>
              </div>
            </Show>
          )}
        </For>

        <div class="inline-block md:hidden">
          <button
            class="btn w-32"
            onClick={makePlayerActionModeClickHandler(opts.player, opts.playerOnAction)}
            type="button"
          >
            Stats !
          </button>
        </div>

        <div class="flex w-8 flex-col rounded-xs bg-slate-400/50 text-center">
          <div class="text-success">{playerStats?.scores.total || 0}</div>
          <div class="text-accent-content">{playerStats?.rebonds.total || 0}</div>
          <div class="text-error">{playerStats?.fouls || 0}</div>
        </div>
      </div>
    </div>
  )
}

function renderPlayerHeader(playerId: string | null) {
  const player =
    playerId === TEAM_OPPONENT_ID
      ? { firstName: '', jerseyNumber: 'XX', nicName: 'Adversaire' }
      : orchestrator.getPlayer(playerId)

  return (
    <div class="my-2 grid w-full grid-cols-3 gap-3 rounded-xs bg-neutral p-3 text-neutral-content">
      <div>
        <Shirt size={28} />
      </div>
      <div class="text-center">
        <div class="text-xl">{player?.nicName ? player.nicName : player?.firstName}</div>
        <div class="text-sm">Action</div>
      </div>
      <div class="text-right text-3xl">{player?.jerseyNumber}</div>
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

        <div class="stat place-items-center">
          <div class="stat-title">Interceptions</div>
          <div class="stat-value text-warning">{statSummary.teamSteals}</div>
          <div class="stat-desc">Total balles gagnés/exploit indiv</div>
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
  playersInTheFive: MadSignal<string[]>
  match: Match | null
  statSummary: StatMatchSummary
  setStatSummary: SetStoreFunction<StatMatchSummary>
  disableClearLastAction: MadSignal<boolean>
}) {
  const inTheFive = options.playersInTheFive.get()

  if (countLiveInFive(inTheFive) === options.sortedPlayers.length) {
    return (
      <div class="alert alert-info">
        <Meh size={42} />
        <span>Le banc est vide !</span>
      </div>
    )
  }

  return (
    <For each={options.sortedPlayers}>
      {(player) => (
        <Show when={player && !options.playersInTheFive.get().includes(player.id)}>
          {renderPlayerBench({
            disableClearLastAction: options.disableClearLastAction,
            match: options.match,
            player,
            playersInTheFive: options.playersInTheFive,
            setStatSummary: options.setStatSummary,
            statSummary: options.statSummary,
          })}
        </Show>
      )}
    </For>
  )
}

function renderTheTeamFive(opts: {
  sortedPlayers: Array<Player | null>
  playersInTheFive: MadSignal<string[]>
  match: Match | null
  statSummary: StatMatchSummary
  setStatSummary: SetStoreFunction<StatMatchSummary>
  disableClearLastAction: MadSignal<boolean>
  matchIsPlaying: MadSignal<boolean>
  playerOnAction: MadSignal<string | null>
}) {
  if (countLiveInFive(opts.playersInTheFive.get()) < 1) {
    return (
      <div class="alert alert-info">
        <MessageSquareWarning size={42} />
        <span>Veuillez sélectionner votre 5 de départ depuis le banc.</span>
      </div>
    )
  }
  return (
    <div class={`${countLiveInFive(opts.playersInTheFive.get()) === 5 ? '' : 'bg-warning/50'} rounded-xs`}>
      <For each={opts.sortedPlayers}>
        {(player) => (
          <Show when={player && opts.playersInTheFive.get().includes(player.id)}>
            {renderPlayerButton({
              disableClearLastAction: opts.disableClearLastAction,
              match: opts.match,
              matchIsPlaying: opts.matchIsPlaying,
              player,
              playerInTheFive: opts.playersInTheFive,
              playerOnAction: opts.playerOnAction,
              setStatSummary: opts.setStatSummary,
              statSummary: opts.statSummary,
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
  const matchIsPlaying: MadSignal<boolean> = new MadSignal(false)

  // Live-scoring lease: only the active scorer may push stats to the server.
  const [leaseState, setLeaseState] = createSignal<LeaseUiState>('unknown')
  const [leaseHolderName, setLeaseHolderName] = createSignal<string | null>(null)
  const leaseBlocked = createMemo(() => leaseState() === 'taken-by-other')
  let holdsLease = false
  let leaseTimer: ReturnType<typeof setInterval> | undefined

  function resolveHolderName(holder: LeaseHolder | null): string | null {
    return holder?.name || holder?.email || null
  }

  async function runLeaseCycle(): Promise<void> {
    const userId = isLoggedIn() ? (currentUser.get()?.id ?? null) : null
    if (!isAuthEnabled || !userId) {
      return
    }
    try {
      const result = await acquireMatchLease(matchId)
      holdsLease = true
      setLeaseHolderName(null)
      setLeaseState(leaseStateForMe({ scorer: result.scorer, scorerLockUntil: result.scorerLockUntil }, userId))
    } catch (err) {
      if (isLeaseHeldError(err)) {
        holdsLease = false
        setLeaseHolderName(resolveHolderName(getLeaseHolderFromError(err)))
        setLeaseState('taken-by-other')
      } else {
        // Server unreachable: local scoring stays enabled, the next cycle
        // retries silently (the server hook remains the safety net).
        holdsLease = false
        setLeaseState('offline')
      }
    }
  }

  async function forceTakeLease(): Promise<void> {
    const confirmed = await confirmAction(
      'Prendre la main',
      'La saisie est en cours par un autre utilisateur. Voulez-vous prendre la main ?',
      'Non',
      'Prendre la main'
    )
    if (!confirmed) {
      return
    }
    const userId = currentUser.get()?.id ?? null
    if (!userId) {
      return
    }
    try {
      const result = await acquireMatchLease(matchId, { force: true })
      holdsLease = true
      setLeaseHolderName(null)
      setLeaseState(leaseStateForMe({ scorer: result.scorer, scorerLockUntil: result.scorerLockUntil }, userId))
      toast('Vous avez pris la main sur la saisie.', 'success')
    } catch {
      toast('Impossible de prendre la main.', 'error')
    }
  }

  onMount(() => {
    if (!isAuthEnabled || !isLoggedIn() || match?.status === 'locked') {
      return
    }
    runLeaseCycle()
    leaseTimer = setInterval(() => {
      runLeaseCycle()
    }, LEASE_HEARTBEAT_MS)
  })

  onCleanup(() => {
    if (leaseTimer) {
      clearInterval(leaseTimer)
      leaseTimer = undefined
    }
    if (holdsLease) {
      // Best effort: on failure the server TTL expires by itself.
      releaseMatchLease(matchId).catch(() => undefined)
    }
  })

  return (
    <div class="w-full">
      <Show when={match?.championship}>
        <div class="mb-2 flex justify-center">
          <span class="badge badge-neutral gap-1">{match?.championship}</span>
        </div>
      </Show>
      <div class="w-full rounded-xs border border-neutral bg-secondary text-secondary-content">
        <BsScoreCard
          date={match?.date || null}
          localName={team?.name}
          localScore={statSummary.teamScore}
          location={match?.type}
          visitorName={match?.opponent}
          visitorScore={statSummary.opponentScore}
        />
      </div>

      <Show when={leaseBlocked()}>
        <div class="my-3">
          <BsLeaseBanner
            holderName={leaseHolderName()}
            onForce={forceTakeLease}
            showForceButton={canManageStaff(currentRole.get())}
          />
        </div>
      </Show>

      <Show when={!isStatMode.get()}>
        <Show when={leaseBlocked()}>
          <button
            class="btn btn-primary w-full"
            onClick={makeOpenStatModeClickHandler(isStatMode)}
            onKeyDown={makeOpenStatModeKeyDownHandler(isStatMode)}
            type="button"
          >
            <ChartLine />
            Tableau des stats
            <ChevronRight />
          </button>
        </Show>
        <Show when={!leaseBlocked()}>
          <div class="divider">
            Le 5 (
            <span class={countLiveInFive(playersInTheFive.get()) === 5 ? 'text-success' : 'text-error'}>
              {countLiveInFive(playersInTheFive.get())}
            </span>
            )
          </div>
          <Show when={!playerOnAction.get()}>
            <div class="w-full">
              {renderTheTeamFive({
                disableClearLastAction,
                match,
                matchIsPlaying,
                playerOnAction,
                playersInTheFive,
                setStatSummary,
                sortedPlayers,
                statSummary,
              })}

              <hr />

              <div class="my-3 flex w-full flex-row md:my-4">
                <div class="flex w-full items-center gap-1 rounded-lg border border-primary bg-accent p-1 text-accent-content">
                  <div class="flex-none">
                    <Users size={32} />
                  </div>
                  <div class="inline-block flex-auto">
                    <div class="text-center text-xl">Équipe adverse</div>
                  </div>
                  <For each={STATS_MATCH_ACTIONS}>
                    {(statAction) => (
                      <Show
                        when={
                          !statAction.secondaryAction &&
                          statAction.opponentMatter &&
                          ((matchIsPlaying.get() && statAction.inGameAction) ||
                            (!matchIsPlaying.get() && !statAction.inGameAction))
                        }
                      >
                        <div class="hidden flex-none md:inline-block">
                          <button
                            class={`btn btn-${statAction.type}`}
                            onClick={makeOpponentRegisterStatHandler({
                              disableClearLastAction,
                              match,
                              setStatSummary,
                              statAction,
                              statSummary,
                            })}
                            onKeyDown={makeOpponentRegisterStatHandler({
                              disableClearLastAction,
                              match,
                              setStatSummary,
                              statAction,
                              statSummary,
                            })}
                            type="button"
                          >
                            {statAction.icon()}
                          </button>
                          <div class="text-center text-xs">{statAction.label1}</div>
                        </div>
                      </Show>
                    )}
                  </For>

                  <div class="inline-block md:hidden">
                    <button class="btn w-32" onClick={makeOpponentActionModeClickHandler(playerOnAction)} type="button">
                      Stats !
                    </button>
                  </div>

                  <div class="flex w-8 flex-col rounded-xs bg-slate-400/50 text-center">
                    <div class="text-success">{statSummary.opponentScore || 0}</div>
                    <div class="text-accent-content">{statSummary.rebonds.opponentTotal || 0}</div>
                    <div class="text-error">{statSummary.opponentFouls || 0}</div>
                  </div>
                </div>
              </div>

              <button
                class={`btn btn-lg btn-${matchIsPlaying.get() ? 'error' : 'success'} w-full text-xl`}
                onClick={makeStopStartGameClickHandler({
                  disableClearLastAction,
                  gameIsPlaying: matchIsPlaying,
                  match,
                  setStatSummary,
                  statSummary,
                })}
                type="button"
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
                class="btn btn-warning w-full"
                disabled={disableClearLastAction.get()}
                onClick={makeRemoveLastActionClickHandler(match, setStatSummary, disableClearLastAction)}
                onKeyDown={makeRemoveLastActionKeyDownHandler(match, setStatSummary, disableClearLastAction)}
                type="button"
              >
                <Eraser />
                Effacer la dernière action
                <TriangleAlert />
              </button>

              <div class="divider">Le Banc</div>
              {renderTheTeamBench({
                disableClearLastAction,
                match,
                playersInTheFive,
                setStatSummary,
                sortedPlayers,
                statSummary,
              })}

              <hr />

              <button
                class="btn btn-primary w-full"
                onClick={makeOpenStatModeClickHandler(isStatMode)}
                onKeyDown={makeOpenStatModeKeyDownHandler(isStatMode)}
                type="button"
              >
                <ChartLine />
                Tableau des stats
                <ChevronRight />
              </button>
            </div>
          </Show>

          <Show when={playerOnAction.get()}>
            {renderPlayerHeader(playerOnAction.get())}
            <div class="grid w-full grid-cols-2 gap-3 py-2">
              <For each={STATS_MATCH_ACTIONS}>
                {(item) => (
                  <Show when={!item.secondaryAction}>
                    <button
                      class={`btn btn-${item.type}`}
                      onClick={makePlayerOnActionStatClickHandler(
                        { disableClearLastAction, match, setStatSummary, statSummary },
                        item,
                        playerOnAction
                      )}
                      type="button"
                    >
                      {item.icon()}
                      <span class="text-2xl">{item.label1}</span>{' '}
                    </button>
                  </Show>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>

      <Show when={isStatMode.get()}>{renderStatGrid(statSummary)}</Show>

      <hr class="print:hidden" />

      <button
        class="btn btn-outline w-full print:hidden"
        onClick={makeBackClickHandler(match, isStatMode, playerOnAction)}
        type="button"
      >
        <ChevronLeft />
        <span>Retour</span>
      </button>
    </div>
  )
}
