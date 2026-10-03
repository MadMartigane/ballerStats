import { Lock, Pencil, Save } from 'lucide-solid'
import { createSignal, Show } from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'
import { updateMatch } from '../../libs/stores/matchs-store'
import {
  buildMatchFormatConfig,
  formatMatchFormat,
  formatTheoreticalTotal,
  isMatchFormatConfig,
  type MatchFormatConfig,
  type ResolvedMatchFormat,
} from '../../libs/team/match-format'
import { toast } from '../../libs/utils/utils'
import BsInput from '../input/input'
import type { BsMatchFormatLineProps } from './match-format-line.d'

/** Provenance badge; the category is named only when the preset level supplied the format. */
export function formatSourceLabel(format: ResolvedMatchFormat, category?: string | null): string {
  switch (format.source) {
    case 'match-override':
      return 'Réglage du match'
    case 'team-default':
      return 'Format par défaut de l’équipe'
    case 'category-preset':
      return category ? `Préréglage de la catégorie ${category}` : 'Préréglage de la catégorie d’âge'
    default:
      return 'Format par défaut'
  }
}

/** Next editor values seeded from the resolved format, so the editor opens on the real numbers. */
function initialValues(format: ResolvedMatchFormat): Record<string, string> {
  return {
    periodLengthMinutes: String(format.periodLengthMinutes),
    periods: String(format.periods),
    playersOnCourt: String(format.playersOnCourt),
  }
}

function persistFormat(props: BsMatchFormatLineProps, format: MatchFormatConfig): void {
  props.match.update({ matchFormat: format })
  updateMatch(props.match.id, props.match.getRawData())
  props.onSaved(props.match.getRawData())
}

function makeEditClickHandler(
  props: BsMatchFormatLineProps,
  setEditing: (value: boolean) => void,
  setValues: SetStoreFunction<Record<string, string>>
) {
  return () => {
    setValues(initialValues(props.format))
    setEditing(true)
  }
}

function makeValueChangeHandler(setValues: SetStoreFunction<Record<string, string>>, field: string) {
  return (value: string) => setValues(field, value)
}

function makeSaveClickHandler(
  props: BsMatchFormatLineProps,
  setEditing: (value: boolean) => void,
  values: Record<string, string>
) {
  return () => {
    const format = buildMatchFormatConfig(values.periods, values.periodLengthMinutes, values.playersOnCourt)
    if (!format) {
      toast('Format invalide : saisir trois entiers positifs.', 'error')
      return
    }

    persistFormat(props, format)
    toast('Format du match enregistré', 'success')
    setEditing(false)
  }
}

/** Writes the current fallback into the match, so the match owns the value from then on. */
function makeApplyFallbackClickHandler(props: BsMatchFormatLineProps, setEditing: (value: boolean) => void) {
  return () => {
    const { source: _source, ...config } = props.format
    persistFormat(props, config)
    toast('Format par défaut appliqué au match', 'success')
    setEditing(false)
  }
}

/**
 * Format line for the match detail page: the format the match was played under,
 * its theoretical total, and where the value comes from.
 *
 * It owns its lock rule: the status is read from `props.match`, so no parent can
 * render the editor on a locked match.
 */
export function BsMatchFormatLine(props: BsMatchFormatLineProps) {
  const locked = () => props.match.status === 'locked'
  const [editing, setEditing] = createSignal(false)
  const [values, setValues] = createStore<Record<string, string>>(initialValues(props.format))

  const canApplyFallback = () =>
    !isMatchFormatConfig(props.match.matchFormat) && props.format.source !== 'match-override'
  const onEditClick = makeEditClickHandler(props, setEditing, setValues)
  const onSaveClick = makeSaveClickHandler(props, setEditing, values)
  const onApplyFallbackClick = makeApplyFallbackClickHandler(props, setEditing)

  return (
    <div class="print:break-inside-avoid">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="flex items-center gap-1 font-bold">
          Format du match
          <Show when={locked()}>
            <Lock size={16} />
          </Show>
        </h3>
        <span class="badge badge-outline">{formatSourceLabel(props.format, props.category)}</span>
        <Show when={!locked()}>
          <button class="btn btn-sm btn-outline print:hidden" onClick={onEditClick} type="button">
            <Pencil size={16} />
            Modifier
          </button>
        </Show>
      </div>

      <p class="mt-1">{formatMatchFormat(props.format)}</p>
      <p class="text-sm opacity-70">{formatTheoreticalTotal(props.format)}</p>

      <Show when={!locked() && editing()}>
        <div class="mt-2 flex flex-col gap-2 rounded-lg border border-base-300 p-3 print:hidden">
          <BsInput
            label="Périodes"
            onChange={makeValueChangeHandler(setValues, 'periods')}
            placeholder="4"
            type="text"
            value={values.periods}
          />
          <BsInput
            label="Durée d’une période (min)"
            onChange={makeValueChangeHandler(setValues, 'periodLengthMinutes')}
            placeholder="8"
            type="text"
            value={values.periodLengthMinutes}
          />
          <BsInput
            label="Joueurs sur le terrain"
            onChange={makeValueChangeHandler(setValues, 'playersOnCourt')}
            placeholder="5"
            type="text"
            value={values.playersOnCourt}
          />

          <div class="mt-1 flex flex-wrap gap-2">
            <button class="btn btn-primary" onClick={onSaveClick} type="button">
              <Save />
              Enregistrer le format
            </button>
            <Show when={canApplyFallback()}>
              <button class="btn btn-outline" onClick={onApplyFallbackClick} type="button">
                Appliquer le format par défaut
              </button>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
