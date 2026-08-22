import { MessageCircleWarning, Save, UserPlus, Users, X } from 'lucide-solid'
import { createMemo, For, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import bsEventBus from '../../libs/event-bus/event-bus'
import MadSignal from '../../libs/mad-signal'
import { getUniqueChampionships, groupMatchesByChampionship } from '../../libs/match/championship-util'
import Match from '../../libs/match/match'
import type { MatchRawData, MatchType } from '../../libs/match/match.d'
import orchestrator from '../../libs/orchestrator/orchestrator'
import { goTo, scrollBottom, scrollTop } from '../../libs/utils/utils'
import BsCard from '../card/card'
import BsCombobox from '../combobox/combobox'
import { BsDatePicker } from '../date-picker/date-picker'
import BsInput from '../input/input'
import BsMatch, { BsMatchTypeText } from '../match-tile/match-tile'
import BsSelect from '../select/select'
import BsToggle from '../toggle/toggle'

let isEditingNewMatch = false
const isAddingMatch: MadSignal<boolean> = new MadSignal(false)
const canAddMatch: MadSignal<boolean> = new MadSignal(false)
const matchLength: MadSignal<number> = new MadSignal(orchestrator.Matchs.length)
const [matchs, setMatchs] = createStore(orchestrator.Matchs.matchs)
const [teams, setTeams] = createStore(orchestrator.Teams.teams)
const championshipOptions = createMemo(() => getUniqueChampionships(matchs))
const grouped = createMemo(() => groupMatchesByChampionship(matchs))

let currentMatch: Match | null = null

bsEventBus.addEventListener('BS::MATCHS::CHANGE', () => {
  matchLength.set(orchestrator.Matchs.length)
  setMatchs(orchestrator.Matchs.matchs)
})

bsEventBus.addEventListener('BS::TEAMS::CHANGE', () => {
  setTeams(orchestrator.Teams.teams)
})

function setNewMatchData(data: MatchRawData) {
  if (currentMatch) {
    currentMatch.update(data)
  } else {
    currentMatch = new Match(data)
  }

  canAddMatch.set(currentMatch.isRegisterable)
}

function toggleAddMatch(value: boolean) {
  isAddingMatch.set(value)
}

function registerMatch() {
  if (!currentMatch?.isRegisterable) {
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

function updateMatchOpponent(value: string) {
  setNewMatchData({ opponent: value })
}

function onMatchTypeInput(value: string) {
  onTypeChange(value as MatchType)
}

function updateMatchDate(value: string) {
  setNewMatchData({ date: value })
}

function updateMatchChampionship(value: string) {
  setNewMatchData({ championship: value })
}

function startAddingNewMatch() {
  isEditingNewMatch = true
  toggleAddMatch(true)
  scrollTop()
}

function cancelAddingMatch() {
  toggleAddMatch(false)
  currentMatch = null
  canAddMatch.set(false)
  scrollBottom()
}

function saveMatch() {
  registerMatch()
  scrollBottom()
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
      <h4 class="my-4 inline-flex items-end">
        <MessageCircleWarning class="h-14 w-14" />
        <span class="px-2">Aucun match enregistrée.</span>
      </h4>
    </div>
  )
}

function renderAddMatchButton() {
  return (
    <div class="w-full">
      <hr />
      <div class="footer-buttons-container">
        <button class="btn btn-primary btn-wide" onClick={startAddingNewMatch} type="button">
          <UserPlus />
          Ajouter un match
        </button>
      </div>
    </div>
  )
}

function renderAddingMatchCard() {
  return BsCard({
    body: (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: form-level Enter submission is a legacy behavior preserved during audit fixes
      <form class="flex flex-col gap-2" onKeyDown={onSubmit}>
        <BsSelect
          datas={teams.map((team) => ({ label: team.name, value: team.id }))}
          label="Mon Équipe"
          onValueChange={onTeamChange}
          placeholder="Sélectionnez l’équipe"
          value={currentMatch?.teamId}
        />

        <BsInput
          label="Nom de l’adversaire"
          onChange={updateMatchOpponent}
          placeholder="…"
          type="text"
          value={currentMatch?.opponent || ''}
        />

        <BsSelect
          datas={[
            { label: <BsMatchTypeText type="home" />, value: 'home' },
            { label: <BsMatchTypeText type="outside" />, value: 'outside' },
          ]}
          default={currentMatch && (currentMatch.type as string)}
          label="Localité"
          onValueChange={onMatchTypeInput}
        />

        <BsDatePicker label="Date du match" onChange={updateMatchDate} value={currentMatch?.date} withTime={true} />

        <BsToggle
          label="Match ouvert"
          onChange={onStatusChange}
          size="lg"
          value={currentMatch?.status === 'unlocked'}
        />

        <BsCombobox
          label="Championnat"
          onChange={updateMatchChampionship}
          options={championshipOptions()}
          placeholder="Saisir un championnat…"
          value={currentMatch?.championship || ''}
        />
      </form>
    ),
    footer: (
      <div class="footer-buttons-container">
        <button class="btn btn-primary btn-wide" onClick={cancelAddingMatch} type="button">
          <X />
          Annuler
        </button>

        <button class="btn btn-primary btn-wide" disabled={!canAddMatch.get()} onClick={saveMatch} type="button">
          {isEditingNewMatch ? <UserPlus /> : <Save />}
          {isEditingNewMatch ? 'Ajouter' : 'Enregistrer'}
        </button>
      </div>
    ),
    info: 'Saisissez les info nécessaires pour identifier le match.',
    title: (
      <p class="flex flex-row gap-1">
        <Users />
        {isEditingNewMatch ? 'Nouveau match' : 'Édition du match'}
      </p>
    ),
  })
}

export default function BsMatchs() {
  return (
    <div>
      <Show when={!isAddingMatch.get()}>
        <Show fallback={renderMatchFallback()} when={(matchLength.get() || 0) > 0}>
          <For each={grouped()}>
            {(group) => (
              <section class="w-full">
                <div class="divider">{group.name}</div>
                <div class="flex w-full flex-wrap justify-around gap-4">
                  <For each={group.matchs}>
                    {(match) => (
                      <div class="mx-auto w-fit md:mx-0">
                        <BsMatch match={match} onEdit={editMatch} onStart={startMatch} />
                      </div>
                    )}
                  </For>
                </div>
              </section>
            )}
          </For>
        </Show>
      </Show>
      <Show fallback={renderAddMatchButton()} when={isAddingMatch.get()}>
        {renderAddingMatchCard()}
      </Show>
    </div>
  )
}
