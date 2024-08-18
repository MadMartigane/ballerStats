import {
  BrainCircuit,
  MessageCircleWarning,
  Save,
  Users,
  X,
} from 'lucide-solid'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import Match from '../../libs/match'
import type { MatchType } from '../../libs/match'
import { For, Show } from 'solid-js'
import BsCard from '../card'
import BsInput from '../input'
import type { MatchRawData } from '../../libs/match'
import BsMatch from '../match-tile'
import { createStore } from 'solid-js/store'
import { NAVIGATION_MENU_ENTRIES } from '../../libs/menu'
import { BsMatchTypeText } from '../match-tile/match-tile'
import { goTo } from '../../libs/utils'

let isEditingNewMatch: boolean = false
const isAddingMatch: MadSignal<boolean> = new MadSignal(false)
const canAddMatch: MadSignal<boolean> = new MadSignal(false)
const matchLength: MadSignal<number> = new MadSignal(orchestrator.Matchs.length)
const [matchs, setMatchs] = createStore(orchestrator.Matchs.matchs)
const [teams, setTeams] = createStore(orchestrator.Teams.teams)

const matchMenuEntry = NAVIGATION_MENU_ENTRIES.find(menuEntry => {
  return menuEntry.path === '/match/:id'
})
const matchIcon = matchMenuEntry ? matchMenuEntry.icon() : <BrainCircuit />

let currentMatch: Match | null = null

bsEventBus.addEventListener('BS::MATCHS::CHANGE', () => {
  matchLength.set(orchestrator.Matchs.length)
  setMatchs(orchestrator.Matchs.matchs)
})

bsEventBus.addEventListener('BS::TEAMS::CHANGE', () => {
  setTeams(orchestrator.Teams.teams)
})

function setNewMatchData(data: MatchRawData) {
  if (!currentMatch) {
    currentMatch = new Match(data)
  } else {
    currentMatch.update(data)
  }

  canAddMatch.set(currentMatch.isRegisterable)
}

function toggleAddMatch(value: boolean) {
  isAddingMatch.set(value)
}

function registerMatch() {
  if (!currentMatch || !currentMatch.isRegisterable) {
    return
  }

  if (isEditingNewMatch) {
    orchestrator.Matchs.add(currentMatch)
  } else {
    orchestrator.Matchs.updateMatch(currentMatch)
  }

  toggleAddMatch(false)
  currentMatch = null
  canAddMatch.set(false)
}

function editMatch(match: Match) {
  isEditingNewMatch = false
  currentMatch = new Match(match.getRawData())
  canAddMatch.set(currentMatch.isRegisterable)

  toggleAddMatch(true)
}

function startMatch(match: Match) {
  toggleAddMatch(false)
  goTo(`/match/${match.id}`)
}

function onTypeChange(
  event: Event & {
    currentTarget: HTMLSelectElement
    target: HTMLSelectElement
  },
) {
  const select = event.target
  const value = select.value as MatchType

  setNewMatchData({ type: value })
}

function onTeamChange(
  event: Event & {
    currentTarget: HTMLSelectElement
    target: HTMLSelectElement
  },
) {
  const select = event.target
  const value = select.value

  setNewMatchData({ teamId: value })
}

function onSubmit(event: KeyboardEvent) {
  if (event.key !== 'Enter') {
    return
  }

  registerMatch()
}

function renderMatchFallback() {
  return (
    <div>
      <h4 class="inline-flex items-end my-4">
        <MessageCircleWarning class="w-14 h-14" />
        <span class="px-2">Aucun match enregistrée.</span>
      </h4>
    </div>
  )
}

function renderAddMatchButton() {
  return (
    <div>
      <hr />
      <div class="p-4">
        <button
          class="btn btn-primary btn-wide"
          onClick={() => {
            isEditingNewMatch = true
            toggleAddMatch(true)
          }}
        >
          {matchIcon}
          Ajouter un match
        </button>
      </div>
    </div>
  )
}

function renderAddingMatchCard() {
  return BsCard({
    title: (
      <p class="flex flex-row gap-1">
        <Users />
        {isEditingNewMatch ? 'Nouveau match' : 'Édition du match'}
      </p>
    ),
    info: 'Saisissez les info nécessaires pour identifier le match.',
    body: (
      <form class="flex flex-col gap-2" onKeyDown={onSubmit}>
        <BsInput
          type='text'
          label='Nom de l’adversaire'
          value={currentMatch?.opponent || ''}
          placeholder='OGS U09'
          onChange={(value: string) => {
            setNewMatchData({ opponent: value })
          }}
        />
        <label
          for="new-match-type-select"
          class="block text-sm font-medium mb-2 dark:text-white"
        >
          Localité
        </label>
        <select
          id="new-match-type-select"
          class="py-3 px-4 pe-9 block w-full border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
          onChange={event => {
            onTypeChange(event)
          }}
        >
          <option
            value="home"
            selected={!currentMatch || currentMatch.type === 'home'}
          >
            <BsMatchTypeText type="home" />
          </option>
          <option value="outside" selected={currentMatch?.type === 'outside'}>
            <BsMatchTypeText type="outside" />
          </option>
        </select>
        <label
          for="new-match-team-select"
          class="block text-sm font-medium mb-2 dark:text-white"
        >
          Équipe
        </label>
        <select
          id="new-match-team-select"
          class="py-3 px-4 pe-9 block w-full border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
          onChange={event => {
            onTeamChange(event)
          }}
        >
          <Show when={!currentMatch || !currentMatch.teamId}>
            <option selected>{'Sélectionnez l’équipe'}</option>
          </Show>
          <For each={teams}>
            {team => (
              <option
                value={team.id}
                selected={currentMatch?.teamId === team.id}
              >
                {team.name}
              </option>
            )}
          </For>
        </select>
      </form>
    ),
    footer: (
      <div class="grid grid-cols-2 gap-2">
        <button
          class="btn btn-primary btn-wide"
          onClick={() => {
            toggleAddMatch(false)
            currentMatch = null
            canAddMatch.set(false)
          }}
        >
          <X />
          Annuler
        </button>

        <button
          class="btn btn-primary btn-wide"
          disabled={!canAddMatch.get()}
          onClick={() => {
            registerMatch()
          }}
        >
          {isEditingNewMatch ? matchIcon : <Save />}
          {isEditingNewMatch ? 'Ajouter' : 'Enregistrer'}
        </button>
      </div>
    ),
  })
}

export default function BsMatchs() {
  return (
    <div>
      <Show when={!isAddingMatch.get()}>
        <Show
          when={(matchLength.get() || 0) > 0}
          fallback={renderMatchFallback()}
        >
          <div class="flex flex-wrap gap-4 justify-stretch">
            <For each={matchs}>
              {match => (
                <div class="mx-auto md:mx-0 w-fit">
                  <BsMatch
                    match={match}
                    onEdit={(match: Match) => {
                      editMatch(match)
                    }}
                    onStart={(match: Match) => {
                      startMatch(match)
                    }}
                  />
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
      <Show when={isAddingMatch.get()} fallback={renderAddMatchButton()}>
        {renderAddingMatchCard()}
      </Show>
    </div>
  )
}
