import { Angry, ChevronLeft, User } from 'lucide-solid'
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

  console.log('register new stat item: ', item)
  console.log('register new stat item total: ', match.stats)
  setStatSummary(buildStatSummary(match))
  orchestrator.Matchs.updateMatch(match)
}

function buildStatSummary(match: Match | null) {
  if (!match) {
    return {
      localScore: 0,
      opponentScore: 0,
    }
  }

  const localScore = match.stats.reduce((score, statEntry) => {
    if (
      ['2pts', 'free-throw', '3pts'].includes(statEntry.name) &&
      statEntry.playerId !== TEAM_OPPONENT_ID
    ) {
      return score + statEntry.value
    }

    return score
  }, 0)

  const opponentScore = match.stats.reduce((score, statEntry) => {
    if (
      ['2pts', 'free-throw', '3pts'].includes(statEntry.name) &&
      statEntry.playerId === TEAM_OPPONENT_ID
    ) {
      return score + statEntry.value
    }

    return score
  }, 0)

  return {
    localScore,
    opponentScore,
  }
}

function renderPlayerButton(
  playerId: string,
  match: Match | null,
  actionMode: MadSignal<string | null>,
) {
  const player = orchestrator.getPlayer(playerId)

  if (!player) {
    return (
      <button class="btn btn-neutral basis-2/3">{`Joueur ${playerId} non trouvé`}</button>
    )
  }

  if (!match) {
    return (
      <button class="btn btn-neutral basis-2/3">{`Match non trouvé`}</button>
    )
  }

  return (
    <div class="w-full flex flex-row my-1">
      <button
        class="btn btn-primary basis-2/3"
        onClick={() => {
          openActionMode(player.id, actionMode)
        }}
      >
        <User />
        <span class="text-2xl">{player.jersayNumber}</span> -{' '}
        {player.nicName ? player.nicName : player.firstName}
      </button>
      <div class="basis-1/3">{playerId}</div>
    </div>
  )
}

export default function BsMatch(props: BsMatchProps) {
  const matchId = props.id
  const match = orchestrator.getMatch(matchId)
  const actionMode = new MadSignal(null) as MadSignal<string | null>
  const [statSummary, setStatSummary] = createStore(buildStatSummary(match))

  const team = orchestrator.getTeam(match?.teamId)

  console.log('match: ', match)

  return (
    <div class="w-full">
      <div class="w-full border border-neutral rounded bg-accent text-accent-content">
        <BsScoreCard
          localScore={statSummary.localScore}
          visitorScore={statSummary.opponentScore}
        />
      </div>

      <Show when={!actionMode.get()}>
        <div class="w-full py-2">
          <For each={team?.playerIds}>
            {(playerId: string) =>
              renderPlayerButton(playerId, match, actionMode)
            }
          </For>

          <button
            class="btn btn-accent w-full"
            onClick={() => {
              openActionMode(TEAM_OPPONENT_ID, actionMode)
            }}
          >
            <Angry />
            Adversaire
          </button>
        </div>
      </Show>
      <Show when={actionMode.get()}>
        <div class="w-full py-2 grid grid-cols-2 gap-2">
          <For each={STATS_MATCH_ACTIONS}>
            {item => (
              <button
                class={`btn btn-${item.type}`}
                onClick={() => {
                  registerStat(actionMode.get(), item, match, setStatSummary)
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

        {/* CANCEL ACTION */}
        <button
          class="btn btn-secondary w-full my-2"
          onClick={() => {
            closeActionMode(actionMode)
          }}
        >
          <ChevronLeft />
          <span>Anuler</span>
        </button>
      </Show>
      <pre>{JSON.stringify(statSummary, null, 4)}</pre>

      <pre>{JSON.stringify(match, null, 4)}</pre>
    </div>
  )
}
