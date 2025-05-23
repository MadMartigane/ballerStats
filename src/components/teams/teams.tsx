import { MessageCircleWarning, Save, Users, X } from 'lucide-solid'
import { For, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import type Player from '../../libs/player'
import Team from '../../libs/team'
import type { TeamRawData } from '../../libs/team'
import { scrollBottom, scrollTop } from '../../libs/utils'
import BsCard from '../card'
import BsInput from '../input'
import BsSelectMultiple from '../select-multiple/select-multiple'
import BsTeam from '../team'

let isEditingNewTeam = false
const isAddingTeam: MadSignal<boolean> = new MadSignal(false)
const canAddTeam: MadSignal<boolean> = new MadSignal(false)
const teamLength: MadSignal<number> = new MadSignal(orchestrator.Teams.length)
const [teams, setTeams] = createStore(orchestrator.Teams.teams)

let currentTeam: Team | null = null

bsEventBus.addEventListener('BS::TEAMS::CHANGE', () => {
  teamLength.set(orchestrator.Teams.length)
  setTeams(orchestrator.Teams.teams)
})

function setNewTeamData(data: TeamRawData) {
  if (!currentTeam) {
    currentTeam = new Team(data)
  } else {
    currentTeam.update(data)
  }

  canAddTeam.set(currentTeam.isRegisterable)
}

function toggleAddTeam(value: boolean) {
  isAddingTeam.set(value)
}

function registerTeam() {
  if (!currentTeam || !currentTeam.isRegisterable) {
    return
  }

  if (isEditingNewTeam) {
    orchestrator.Teams.add(currentTeam)
  } else {
    orchestrator.Teams.updateTeam(currentTeam)
  }

  toggleAddTeam(false)
  currentTeam = null
  canAddTeam.set(false)
}

function editTeam(team: Team) {
  isEditingNewTeam = false
  currentTeam = new Team(team.getRawData())
  canAddTeam.set(currentTeam.isRegisterable)

  toggleAddTeam(true)
}

function onSubmit(event: KeyboardEvent) {
  if (event.key !== 'Enter') {
    return
  }

  registerTeam()
}

function updateCurrentTeamPlayerIds(playerIds: string[]) {
  if (playerIds) {
    currentTeam?.update({ playerIds: playerIds })
    return
  }

  currentTeam?.update({ playerIds: [] })
}

function getSelectDataFromPlayer() {
  return orchestrator.Players.players.map((player) => ({
    value: player.id,
    label: player.nicName ? player.nicName : `${player.firstName} ${player.lastName}`,
    badge: renderPlayerBadge(player),
  }))
}

function renderTeamFallback() {
  return (
    <div>
      <h4 class="inline-flex items-end my-4">
        <MessageCircleWarning class="w-14 h-14" />
        <span class="px-2">Aucune équipe enregistrée.</span>
      </h4>
    </div>
  )
}

function renderAddTeamButton() {
  return (
    <div class="w-full">
      <hr />
      <div class="footer-buttons-container">
        <button
          type="button"
          class="btn btn-primary"
          onClick={() => {
            isEditingNewTeam = true
            toggleAddTeam(true)
            scrollTop()
          }}
        >
          <Users />
          Ajouter une équipe
        </button>
      </div>
    </div>
  )
}

function renderPlayerBadge(player: Player) {
  return (
    <>
      <span class="text-warning">{player.jersayNumber}</span>
      <div class="whitespace-nowrap text-base font-medium m-2">
        {player.nicName ? player.nicName : `${player.firstName} ${player.lastName}`}
      </div>
    </>
  )
}

function renderAddingTeamCard() {
  return BsCard({
    title: (
      <p class="flex flex-row gap-1">
        <Users />
        {isEditingNewTeam ? 'Nouvelle équipe' : 'Édition de l’équipe'}
      </p>
    ),
    info: 'Seul le nom de l’équipe est obligatoire',
    body: (
      <form class="flex flex-col gap-2" onKeyDown={onSubmit}>
        {BsInput({
          type: 'text',
          label: 'Nom',
          value: currentTeam?.name || '',
          placeholder: 'BCC U09',
          onChange: (value: string) => {
            setNewTeamData({ name: value })
          },
        })}
        <BsSelectMultiple
          placeholder="Sélection des joueurs"
          data={getSelectDataFromPlayer()}
          selectedIds={currentTeam?.playerIds}
          onChange={(playerIds: string[]) => {
            updateCurrentTeamPlayerIds(playerIds)
          }}
        />
      </form>
    ),
    footer: (
      <div class="footer-buttons-container">
        <button
          type="button"
          class="btn btn-primary btn-wide"
          onClick={() => {
            toggleAddTeam(false)
            currentTeam = null
            canAddTeam.set(false)
            scrollBottom()
          }}
        >
          <X />
          Annuler
        </button>

        <button
          type="button"
          class="btn btn-primary btn-wide"
          disabled={!canAddTeam.get()}
          onClick={() => {
            registerTeam()
            scrollBottom()
          }}
        >
          {isEditingNewTeam ? <Users /> : <Save />}
          {isEditingNewTeam ? 'Ajouter' : 'Enregistrer'}
        </button>
      </div>
    ),
  })
}

export default function BsTeams() {
  return (
    <div>
      <Show when={!isAddingTeam.get()}>
        <Show when={(teamLength.get() || 0) > 0} fallback={renderTeamFallback()}>
          <div class="flex flex-wrap gap-4 w-full justify-around">
            <For each={teams}>
              {(team) => (
                <div class="mx-auto md:mx-0 w-fit">
                  <BsTeam
                    team={team}
                    onEdit={(team) => {
                      editTeam(team)
                    }}
                  />
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
      <Show when={isAddingTeam.get()} fallback={renderAddTeamButton()}>
        {renderAddingTeamCard()}
      </Show>
    </div>
  )
}
