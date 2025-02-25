import { CircleX } from 'lucide-solid'
import { For, Show } from 'solid-js'
import { type SetStoreFunction, createStore } from 'solid-js/store'
import { getShortId } from '../../libs/utils'
import BsSelect from '../select/select'
import type { BsSelectDataSet, BsSelectMultipleDataSelect, BsSelectMultipleProps } from './select-multiple.d'

const defaultPlaceholder = 'Sélection…'

function getAvailableDataSets(allDataSets: Array<BsSelectDataSet>, alreadySelectedDataSets: Array<string>) {
  return allDataSets.reduce(
    (result, currentDataSet) => {
      if (!alreadySelectedDataSets.includes(currentDataSet.value)) {
        result.push(currentDataSet)
      }

      return result
    },
    [] as Array<BsSelectDataSet>,
  )
}

function getSelectDataSetFromAvailableDataSets(
  availableBsSelectDataSets: BsSelectDataSet[],
  placeholder?: string,
): BsSelectDataSet[] {
  const data = placeholder
    ? [
        {
          value: '',
          label: availableBsSelectDataSets.length ? placeholder : 'Aucun joueur disponible.',
          badge: <span>Error</span>,
        },
      ]
    : []

  return [...data, ...availableBsSelectDataSets]
}

function getDataFromProps(props: BsSelectMultipleProps) {
  const availableDataSets = getAvailableDataSets(props.data || [], props.selectedIds || [])

  const selectData = getSelectDataSetFromAvailableDataSets(availableDataSets, props.placeholder)
  const [dataForSelect, setAvailables] = createStore(selectData)
  const disable = dataForSelect.length < 2

  return {
    placeholder: defaultPlaceholder,
    selectId: `bs-select-multiple-${getShortId()}`,
    ...props,
    selectedIds: props.selectedIds || [],
    disable,
    availables: dataForSelect,
    setAvailables,
  } as BsSelectMultipleDataSelect
}

function onSelectionChange(props: BsSelectMultipleDataSelect, setProps: SetStoreFunction<BsSelectMultipleDataSelect>) {
  const selectData = getSelectDataSetFromAvailableDataSets(
    getAvailableDataSets(props.data || [], props.selectedIds || []),
    props.placeholder,
  )

  props.setAvailables(selectData)

  setProps('disable', selectData.length < 2)

  if (props.onChange) {
    if (props.selectedIds?.length) {
      props.onChange(props.selectedIds)
    } else {
      props.onChange([])
    }
  }
}

function onSelect(
  event: Event & { currentTarget: HTMLSelectElement; target: Element },
  props: BsSelectMultipleDataSelect,
  setProps: SetStoreFunction<BsSelectMultipleDataSelect>,
) {
  const selectedId = event.currentTarget.value

  if (!props.selectedIds?.includes(selectedId)) {
    // TODO: HERE !!!!
    setProps('selectedIds', props.selectedIds?.length || 0, selectedId)
  }

  onSelectionChange(props, setProps)
}

function unselectDataSet(
  props: BsSelectMultipleDataSelect,
  setProps: SetStoreFunction<BsSelectMultipleDataSelect>,
  dataSet: BsSelectDataSet,
) {
  if (!props.selectedIds || !props.selectedIds.includes(dataSet.value)) {
    return
  }

  const newSelection = props.selectedIds.filter((currentId) => currentId !== dataSet.value)

  setProps('selectedIds', newSelection)

  onSelectionChange(props, setProps)
}

function renderBsSelectDataSetBadge(
  props: BsSelectMultipleDataSelect,
  setProps: SetStoreFunction<BsSelectMultipleDataSelect>,
  dataSet: BsSelectDataSet,
) {
  return (
    <div class="badge badge-outline p-4 m-1">
      {dataSet.badge}
      <button
        class="btn btn-circle btn-xs btn-ghost"
        type="button"
        onClick={() => {
          unselectDataSet(props, setProps, dataSet)
        }}
      >
        <CircleX />
      </button>
    </div>
  )
}

export default function BsSelectMultiple(props: BsSelectMultipleProps) {
  const [selectProps, setSelectProps] = createStore(getDataFromProps(props))

  return (
    <div class="w-full">
      <Show when={selectProps.label}>
        <label class="block text-sm font-medium mb-2" for={selectProps.selectId}>
          {selectProps.label}
        </label>
      </Show>
      <label class="label" for={selectProps.selectId}>
        Joueur(s) selectionné(s):
      </label>
      <div class="bg-base-200 text-base-content border rounded-xs border-base-100 mx-auto w-11/12 py-4">
        <Show when={selectProps.selectedIds?.length} fallback={'Aucun joueur sélectionné.'}>
          <For each={selectProps.selectedIds}>
            {(value) => {
              const dataSet = selectProps.data?.find((candidate) => candidate.value === value)
              if (!dataSet) {
                return
              }

              return renderBsSelectDataSetBadge(selectProps, setSelectProps, dataSet)
            }}
          </For>
        </Show>
      </div>

      <BsSelect
        id={selectProps.selectId}
        onChange={(event) => {
          onSelect(event, selectProps, setSelectProps)
        }}
        default=""
        datas={selectProps.availables}
        disabled={selectProps.disable}
      />
    </div>
  )
}
