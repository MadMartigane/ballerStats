import { CircleX } from 'lucide-solid'
import { For, Show } from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'
import { getShortId } from '../../libs/utils/utils'
import BsSelect from '../select/select'
import type { BsSelectDataSet, BsSelectMultipleDataSelect, BsSelectMultipleProps } from './select-multiple.d'

const defaultPlaceholder = 'Sélection…'

function getAvailableDataSets(allDataSets: BsSelectDataSet[], alreadySelectedDataSets: string[]) {
  return allDataSets.reduce((result, currentDataSet) => {
    if (!alreadySelectedDataSets.includes(currentDataSet.value)) {
      result.push(currentDataSet)
    }

    return result
  }, [] as BsSelectDataSet[])
}

function getSelectDataSetFromAvailableDataSets(
  availableBsSelectDataSets: BsSelectDataSet[],
  placeholder?: string
): BsSelectDataSet[] {
  const data = placeholder
    ? [
        {
          badge: <span>Error</span>,
          label: availableBsSelectDataSets.length ? placeholder : 'Aucun joueur disponible.',
          value: '',
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
    availables: dataForSelect,
    disable,
    selectedIds: props.selectedIds || [],
    setAvailables,
  } as BsSelectMultipleDataSelect
}

function onSelectionChange(props: BsSelectMultipleDataSelect, setProps: SetStoreFunction<BsSelectMultipleDataSelect>) {
  const selectData = getSelectDataSetFromAvailableDataSets(
    getAvailableDataSets(props.data || [], props.selectedIds || []),
    props.placeholder
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
  setProps: SetStoreFunction<BsSelectMultipleDataSelect>
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
  dataSet: BsSelectDataSet
) {
  if (!props.selectedIds?.includes(dataSet.value)) {
    return
  }

  const newSelection = props.selectedIds.filter((currentId) => currentId !== dataSet.value)

  setProps('selectedIds', newSelection)

  onSelectionChange(props, setProps)
}

function makeUnselectDataSetClickHandler(
  props: BsSelectMultipleDataSelect,
  setProps: SetStoreFunction<BsSelectMultipleDataSelect>,
  dataSet: BsSelectDataSet
) {
  return () => {
    unselectDataSet(props, setProps, dataSet)
  }
}

function makeSelectMultipleChangeHandler(
  props: BsSelectMultipleDataSelect,
  setProps: SetStoreFunction<BsSelectMultipleDataSelect>
) {
  return (event: Event & { currentTarget: HTMLSelectElement; target: Element }) => {
    onSelect(event, props, setProps)
  }
}

function renderBsSelectDataSetBadge(
  props: BsSelectMultipleDataSelect,
  setProps: SetStoreFunction<BsSelectMultipleDataSelect>,
  dataSet: BsSelectDataSet
) {
  return (
    <div class="badge badge-outline m-1 p-4">
      {dataSet.badge}
      <button
        class="btn btn-circle btn-xs btn-ghost"
        onClick={makeUnselectDataSetClickHandler(props, setProps, dataSet)}
        type="button"
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
        <label class="mb-2 block font-medium text-sm" for={selectProps.selectId}>
          {selectProps.label}
        </label>
      </Show>
      <label class="label" for={selectProps.selectId}>
        Joueur(s) selectionné(s):
      </label>
      <div class="mx-auto w-11/12 rounded-xs border border-base-100 bg-base-200 py-4 text-base-content">
        <Show fallback={'Aucun joueur sélectionné.'} when={selectProps.selectedIds?.length}>
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
        datas={selectProps.availables}
        default=""
        disabled={selectProps.disable}
        id={selectProps.selectId}
        onChange={makeSelectMultipleChangeHandler(selectProps, setSelectProps)}
      />
    </div>
  )
}
