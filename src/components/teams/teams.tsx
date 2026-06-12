import { MessageCircleWarning, Save, Users, X } from 'lucide-solid'
import { For, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import type Player from '../../libs/player'
import type { TeamRawData } from '../../libs/team'
import Team from '../../libs/team'
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
  if (currentTeam) {
    currentTeam.update(data)
  } else {
    currentTeam = new Team(data)
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
    currentTeam?.update({ playerIds })
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
      <h4 class="my-4 inline-flex items-end">
        <MessageCircleWarning class="h-14 w-14" />
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
          class="btn btn-primary"
          onClick={() => {
            isEditingNewTeam = true
            toggleAddTeam(true)
            scrollTop()
          }}
          type="button"
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
      <span class="text-warning">{player.jerseyNumber}</span>
      <div class="m-2 whitespace-nowrap font-medium text-base">
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
          data={getSelectDataFromPlayer()}
          onChange={(playerIds: string[]) => {
            updateCurrentTeamPlayerIds(playerIds)
          }}
          placeholder="Sélection des joueurs"
          selectedIds={currentTeam?.playerIds}
        />
      </form>
    ),
    footer: (
      <div class="footer-buttons-container">
        <button
          class="btn btn-primary btn-wide"
          onClick={() => {
            toggleAddTeam(false)
            currentTeam = null
            canAddTeam.set(false)
            scrollBottom()
          }}
          type="button"
        >
          <X />
          Annuler
        </button>

        <button
          class="btn btn-primary btn-wide"
          disabled={!canAddTeam.get()}
          onClick={() => {
            registerTeam()
            scrollBottom()
          }}
          type="button"
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
        <Show fallback={renderTeamFallback()} when={(teamLength.get() || 0) > 0}>
          <div class="flex w-full flex-wrap justify-around gap-4">
            <For each={teams}>
              {(team) => (
                <div class="mx-auto w-fit md:mx-0">
                  <BsTeam
                    onEdit={(team) => {
                      editTeam(team)
                    }}
                    team={team}
                  />
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
      <Show fallback={renderAddTeamButton()} when={isAddingTeam.get()}>
        {renderAddingTeamCard()}
      </Show>
    </div>
  )
}
