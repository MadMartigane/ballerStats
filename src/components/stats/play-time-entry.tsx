import { Eraser, Lock, Save } from 'lucide-solid'
import { For, Show } from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'
import type Match from '../../libs/match/match'
import type Player from '../../libs/player/player'
import { updateMatch } from '../../libs/stores/matchs-store'
import { toast } from '../../libs/utils/utils'
import BsInput from '../input/input'
import type { BsPlayTimeEntryProps } from './play-time-entry.d'

function playerLabel(player: Player): string {
  const name = player.nicName || player.firstName || ''
  return `${player.jerseyNumber ?? ''} ${name}`.trim()
}

function initialValues(match: Match, roster: Player[]): Record<string, string> {
  const values: Record<string, string> = {}
  for (const player of roster) {
    const minutes = match.tablePlayTimes?.[player.id]
    values[player.id] = minutes === undefined ? '' : String(minutes)
  }
  return values
}

function persistPlayTimes(props: BsPlayTimeEntryProps, tablePlayTimes: Record<string, number> | undefined) {
  props.match.update({ tablePlayTimes })
  updateMatch(props.match.id, props.match.getRawData())
  props.onSaved(props.match.getRawData())
}

/** Returns the next record, or null when any input is not a valid non-negative integer. */
function buildTablePlayTimes(roster: Player[], values: Record<string, string>): Record<string, number> | null {
  const nextTablePlayTimes: Record<string, number> = {}

  for (const player of roster) {
    const rawValue = (values[player.id] ?? '').trim()
    if (rawValue === '') {
      continue
    }

    const minutes = Number.parseInt(rawValue, 10)
    if (!Number.isFinite(minutes) || minutes < 0) {
      toast(`Temps invalide pour ${playerLabel(player)} : "${rawValue}"`, 'error')
      return null
    }

    nextTablePlayTimes[player.id] = minutes
  }

  return nextTablePlayTimes
}

function makeValueChangeHandler(setValues: SetStoreFunction<Record<string, string>>, playerId: string) {
  return (value: string) => setValues(playerId, value)
}

function makeSaveClickHandler(props: BsPlayTimeEntryProps, values: Record<string, string>) {
  return () => {
    const nextTablePlayTimes = buildTablePlayTimes(props.roster, values)
    if (nextTablePlayTimes === null) {
      return
    }

    persistPlayTimes(props, nextTablePlayTimes)
    toast('Temps de jeu enregistrés', 'success')
  }
}

function makeClearClickHandler(props: BsPlayTimeEntryProps, setValues: SetStoreFunction<Record<string, string>>) {
  return () => {
    persistPlayTimes(props, undefined)
    setValues(initialValues(props.match, props.roster))
    toast('Temps de jeu effacés', 'success')
  }
}

/**
 * Table-entry editor for play times taken from the official match sheet.
 *
 * A locked match is locked: the recorded minutes stay readable but no control
 * writes them.
 */
export function BsPlayTimeEntry(props: BsPlayTimeEntryProps) {
  const [values, setValues] = createStore(initialValues(props.match, props.roster))
  const locked = () => props.match.status === 'locked'

  return (
    <div class="my-3 flex flex-col gap-2 rounded-lg border border-base-300 p-3">
      <h3 class="flex items-center gap-1 font-bold">
        Temps de jeu (feuille de match)
        <Show when={locked()}>
          <Lock size={16} />
        </Show>
      </h3>
      <p class="text-sm opacity-70">
        Temps relevés sur la feuille officielle, en minutes entières. Ces valeurs remplacent les temps calculés.
      </p>

      <Show when={locked()}>
        <p class="text-sm opacity-70">Match verrouillé : temps non modifiables.</p>
      </Show>

      <For each={props.roster}>
        {(player) => (
          <BsInput
            disabled={locked()}
            label={playerLabel(player)}
            onChange={makeValueChangeHandler(setValues, player.id)}
            placeholder="min"
            type="text"
            value={values[player.id] ?? ''}
          />
        )}
      </For>

      <Show when={!locked()}>
        <div class="mt-2 flex flex-wrap gap-2">
          <button class="btn btn-primary" onClick={makeSaveClickHandler(props, values)} type="button">
            <Save />
            Enregistrer les temps
          </button>
          <button class="btn btn-outline" onClick={makeClearClickHandler(props, setValues)} type="button">
            <Eraser />
            Tout effacer
          </button>
        </div>
      </Show>
    </div>
  )
}
