import { MessageCircleWarning, Save, Users, X } from 'lucide-solid'
import { createMemo, For, Show } from 'solid-js'
import MadSignal from '../../libs/mad-signal'
import type { PlayerRawData } from '../../libs/player/player.d'
import { players } from '../../libs/stores/players-store'
import { addTeam, teams, updateTeam } from '../../libs/stores/teams-store'
import {
  AGE_CATEGORY_PRESETS,
  type AgeCategory,
  buildMatchFormatConfig,
  formatMatchFormat,
  formatTheoreticalTotal,
  type MatchFormatConfig,
  type ResolvedMatchFormat,
  resolveMatchFormat,
} from '../../libs/team/match-format'
import Team from '../../libs/team/team'
import type { TeamRawData } from '../../libs/team/team.d'
import { scrollBottom, scrollTop } from '../../libs/utils/utils'
import BsCard from '../card/card'
import BsInput from '../input/input'
import BsSelect from '../select/select'
import BsSelectMultiple from '../select-multiple/select-multiple'
import BsTeam from '../team/team'

let isEditingNewTeam = false
const isAddingTeam: MadSignal<boolean> = new MadSignal(false)
const canAddTeam: MadSignal<boolean> = new MadSignal(false)

let currentTeam: Team | null = null

// The form's inputs are uncontrolled, so the resolved-format preview needs its own
// reactive source; it is refreshed every time the draft team changes.
const formatPreview: MadSignal<ResolvedMatchFormat> = new MadSignal(resolveMatchFormat(null))
const formatOverrideHint: MadSignal<string> = new MadSignal('')

// Raw text of the three default-format inputs; all three must hold a positive integer to apply.
let overridePeriodsText = ''
let overridePeriodLengthText = ''
let overridePlayersOnCourtText = ''

const CATEGORY_SELECT_DATAS = [
  { label: '—', value: '' },
  ...(Object.keys(AGE_CATEGORY_PRESETS) as AgeCategory[]).map((category) => {
    const preset = AGE_CATEGORY_PRESETS[category]
    return { label: `${category} — ${preset.periods} périodes de ${preset.periodLengthMinutes} min`, value: category }
  }),
]

function formatPreviewText(format: ResolvedMatchFormat): string {
  return `Format par défaut : ${formatMatchFormat(format)} — ${formatTheoreticalTotal(format)}. Chaque match part de ce format et garde le sien.`
}

function refreshFormatPreview() {
  formatPreview.set(resolveMatchFormat(currentTeam?.getRawData() ?? null))
}

function resetFormatOverrideInputs(format?: MatchFormatConfig | null) {
  overridePeriodsText = format?.periods?.toString() ?? ''
  overridePeriodLengthText = format?.periodLengthMinutes?.toString() ?? ''
  overridePlayersOnCourtText = format?.playersOnCourt?.toString() ?? ''
  formatOverrideHint.set('')
}

function isFormatOverrideBlank(): boolean {
  return overridePeriodsText === '' && overridePeriodLengthText === '' && overridePlayersOnCourtText === ''
}

function applyFormatOverride() {
  const override = buildMatchFormatConfig(overridePeriodsText, overridePeriodLengthText, overridePlayersOnCourtText)

  if (override) {
    formatOverrideHint.set('')
    setNewTeamData({ matchFormat: override })
    return
  }

  if (isFormatOverrideBlank()) {
    formatOverrideHint.set('')
    setNewTeamData({ matchFormat: null })
    return
  }

  formatOverrideHint.set(
    'Format par défaut invalide : saisir trois entiers positifs, ou laisser les trois champs vides.'
  )
}

function onCategoryChange(value: string) {
  setNewTeamData({ category: value ? (value as AgeCategory) : null })
}

function onOverridePeriodsChange(value: string) {
  overridePeriodsText = value
  applyFormatOverride()
}

function onOverridePeriodLengthChange(value: string) {
  overridePeriodLengthText = value
  applyFormatOverride()
}

function onOverridePlayersOnCourtChange(value: string) {
  overridePlayersOnCourtText = value
  applyFormatOverride()
}

function setNewTeamData(data: TeamRawData) {
  if (currentTeam) {
    currentTeam.update(data)
  } else {
    currentTeam = new Team(data)
  }

  refreshFormatPreview()
  canAddTeam.set(currentTeam.isRegisterable)
}

function onTeamNameChange(value: string) {
  setNewTeamData({ name: value })
}

function toggleAddTeam(value: boolean) {
  isAddingTeam.set(value)
}

function registerTeam() {
  if (!currentTeam?.isRegisterable) {
    return
  }

  if (isEditingNewTeam) {
    addTeam(currentTeam.getRawData())
  } else {
    updateTeam(currentTeam.id, currentTeam.getRawData())
  }

  toggleAddTeam(false)
  currentTeam = null
  canAddTeam.set(false)
  resetFormatOverrideInputs(null)
  refreshFormatPreview()
}

function editTeam(team: Team) {
  isEditingNewTeam = false
  currentTeam = new Team(team.getRawData())
  canAddTeam.set(currentTeam.isRegisterable)
  resetFormatOverrideInputs(currentTeam.matchFormat)
  refreshFormatPreview()

  toggleAddTeam(true)
}

function onSubmit(event: KeyboardEvent) {
  if (event.key !== 'Enter') {
    return
  }

  registerTeam()
}

function updateCurrentTeamPlayerIds(playerIds: string[]) {
  // playerIds is a required string[] (always truthy, even when empty), so the previous
  // fallback branch `update({ playerIds: [] })` was dead code.
  currentTeam?.update({ playerIds })
}

function startAddingNewTeam() {
  isEditingNewTeam = true
  resetFormatOverrideInputs(null)
  refreshFormatPreview()
  toggleAddTeam(true)
  scrollTop()
}

function cancelAddingTeam() {
  toggleAddTeam(false)
  currentTeam = null
  canAddTeam.set(false)
  resetFormatOverrideInputs(null)
  refreshFormatPreview()
  scrollBottom()
}

function saveTeam() {
  registerTeam()
  scrollBottom()
}

function getSelectDataFromPlayer() {
  return players.map((player) => ({
    badge: renderPlayerBadge(player),
    label: player.nicName ? player.nicName : `${player.firstName} ${player.lastName}`,
    value: player.id ?? '',
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

function AddTeamButton() {
  return (
    <div class="w-full">
      <hr />
      <div class="footer-buttons-container">
        <button class="btn btn-primary" onClick={startAddingNewTeam} type="button">
          <Users />
          Ajouter une équipe
        </button>
      </div>
    </div>
  )
}

function renderPlayerBadge(player: PlayerRawData) {
  return (
    <>
      <span class="text-warning">{player.jerseyNumber}</span>
      <div class="m-2 whitespace-nowrap font-medium text-base">
        {player.nicName ? player.nicName : `${player.firstName} ${player.lastName}`}
      </div>
    </>
  )
}

function TeamAddForm() {
  return (
    <BsCard
      body={
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: form-level Enter submission is a legacy behavior preserved during audit fixes
        <form class="flex flex-col gap-2" onKeyDown={onSubmit}>
          <BsInput
            label="Nom"
            onChange={onTeamNameChange}
            placeholder="BCC U09"
            type="text"
            value={currentTeam?.name || ''}
          />
          <BsSelect
            datas={CATEGORY_SELECT_DATAS}
            label="Catégorie d’âge"
            onValueChange={onCategoryChange}
            value={currentTeam?.category || ''}
          />
          <BsInput
            label="Périodes par défaut"
            onChange={onOverridePeriodsChange}
            placeholder="4"
            type="text"
            value={currentTeam?.matchFormat?.periods?.toString() || ''}
          />
          <BsInput
            label="Durée d’une période par défaut (min)"
            onChange={onOverridePeriodLengthChange}
            placeholder="8"
            type="text"
            value={currentTeam?.matchFormat?.periodLengthMinutes?.toString() || ''}
          />
          <BsInput
            label="Joueurs sur le terrain par défaut"
            onChange={onOverridePlayersOnCourtChange}
            placeholder="5"
            type="text"
            value={currentTeam?.matchFormat?.playersOnCourt?.toString() || ''}
          />
          <Show when={formatOverrideHint.get()}>
            <p class="text-error text-sm">{formatOverrideHint.get()}</p>
          </Show>
          <p class="text-sm opacity-70">{formatPreviewText(formatPreview.get())}</p>
          <BsSelectMultiple
            data={getSelectDataFromPlayer()}
            onChange={updateCurrentTeamPlayerIds}
            placeholder="Sélection des joueurs"
            selectedIds={currentTeam?.playerIds}
          />
        </form>
      }
      footer={
        <div class="footer-buttons-container">
          <button class="btn btn-primary btn-wide" onClick={cancelAddingTeam} type="button">
            <X />
            Annuler
          </button>

          <button class="btn btn-primary btn-wide" disabled={!canAddTeam.get()} onClick={saveTeam} type="button">
            {isEditingNewTeam ? <Users /> : <Save />}
            {isEditingNewTeam ? 'Ajouter' : 'Enregistrer'}
          </button>
        </div>
      }
      info="Seul le nom de l’équipe est obligatoire"
      title={
        <p class="flex flex-row gap-1">
          <Users />
          {isEditingNewTeam ? 'Nouvelle équipe' : 'Édition de l’équipe'}
        </p>
      }
    />
  )
}

export default function BsTeams() {
  const teamLength = createMemo(() => teams.length)
  const visibleTeams = createMemo(() => teams.map((raw) => new Team(raw)))

  return (
    <div>
      <Show when={!isAddingTeam.get()}>
        <Show fallback={renderTeamFallback()} when={(teamLength() || 0) > 0}>
          <div class="flex w-full flex-wrap justify-around gap-4">
            <For each={visibleTeams()}>
              {(team) => (
                <div class="mx-auto w-fit md:mx-0">
                  <BsTeam onEdit={editTeam} team={team} />
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
      <Show fallback={<AddTeamButton />} when={isAddingTeam.get()}>
        <TeamAddForm />
      </Show>
    </div>
  )
}
