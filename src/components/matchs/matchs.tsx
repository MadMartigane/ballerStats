import { MessageCircleWarning, Save, UserPlus, Users, X } from 'lucide-solid'
import { For, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import type { MatchRawData, MatchType } from '../../libs/match'
import Match from '../../libs/match'
import orchestrator from '../../libs/orchestrator/orchestrator'
import { goTo, scrollBottom, scrollTop } from '../../libs/utils'
import BsCard from '../card'
import { BsDatePicker } from '../date-picker/date-picker'
import BsInput from '../input'
import BsMatch from '../match-tile'
import { BsMatchTypeText } from '../match-tile/match-tile'
import BsSelect from '../select/select'
import BsToggle from '../toggle/toggle'

let isEditingNewMatch = false
const isAddingMatch: MadSignal<boolean> = new MadSignal(false)
const canAddMatch: MadSignal<boolean> = new MadSignal(false)
const matchLength: MadSignal<number> = new MadSignal(orchestrator.Matchs.length)
const [matchs, setMatchs] = createStore(getSortedMatchs())
const [teams, setTeams] = createStore(orchestrator.Teams.teams)

let currentMatch: Match | null = null

bsEventBus.addEventListener('BS::MATCHS::CHANGE', () => {
  matchLength.set(orchestrator.Matchs.length)
  setMatchs(getSortedMatchs())
})

bsEventBus.addEventListener('BS::TEAMS::CHANGE', () => {
  setTeams(orchestrator.Teams.teams)
})

function getSortedMatchs() {
  return orchestrator.Matchs.matchs.sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date()
    const dateB = b.date ? new Date(b.date) : new Date()

    return dateA.getTime() - dateB.getTime()
  })
}

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
  scrollTop()
}

function startMatch(match: Match) {
  toggleAddMatch(false)
  goTo(`/match/${match.id}`)
}

function onTypeChange(value: MatchType) {
  setNewMatchData({ type: value })
}

function onTeamChange(value: string) {
  setNewMatchData({ teamId: value })
}

function onStatusChange(isOpen: boolean) {
  setNewMatchData({ status: isOpen ? 'unlocked' : 'locked' })
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
          type="button"
          class="btn btn-primary btn-wide"
          onClick={() => {
            isEditingNewMatch = true
            toggleAddMatch(true)
            scrollTop()
          }}
        >
          <UserPlus />
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
        <BsSelect
          label="Mon Équipe"
          placeholder="Sélectionnez l’équipe"
          value={currentMatch?.teamId}
          datas={teams.map((team) => ({ value: team.id, label: team.name }))}
          onValueChange={(value: string) => {
            onTeamChange(value)
          }}
        />

        <BsInput
          type="text"
          label="Nom de l’adversaire"
          value={currentMatch?.opponent || ''}
          placeholder="…"
          onChange={(value: string) => {
            setNewMatchData({ opponent: value })
          }}
        />

        <BsSelect
          label="Localité"
          default={currentMatch && (currentMatch.type as string)}
          datas={[
            { value: 'home', label: <BsMatchTypeText type="home" /> },
            { value: 'outside', label: <BsMatchTypeText type="outside" /> },
          ]}
          onValueChange={(value: string) => {
            onTypeChange(value as MatchType)
          }}
        />

        <BsDatePicker
          label="Date du match"
          withTime={true}
          value={currentMatch?.date}
          onChange={(value: string) => {
            setNewMatchData({ date: value })
          }}
        />

        <BsToggle
          label="Match ouvert"
          size="lg"
          value={currentMatch?.status === 'unlocked'}
          onChange={(checked) => {
            onStatusChange(checked)
          }}
        />
      </form>
    ),
    footer: (
      <div class="flex flex-col sm:flex-row w-full justify-around">
        <button
          type="button"
          class="btn btn-primary btn-wide"
          onClick={() => {
            toggleAddMatch(false)
            currentMatch = null
            canAddMatch.set(false)
            scrollBottom()
          }}
        >
          <X />
          Annuler
        </button>

        <button
          type="button"
          class="btn btn-primary btn-wide"
          disabled={!canAddMatch.get()}
          onClick={() => {
            registerMatch()
            scrollBottom()
          }}
        >
          {isEditingNewMatch ? <UserPlus /> : <Save />}
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
        <Show when={(matchLength.get() || 0) > 0} fallback={renderMatchFallback()}>
          <div class="flex flex-wrap gap-4 w-full justify-around">
            <For each={matchs}>
              {(match) => (
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
