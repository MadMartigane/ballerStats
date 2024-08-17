import { For, Show } from 'solid-js'
import { createStore, SetStoreFunction, unwrap } from 'solid-js/store'
import Player from '../../libs/player'
import { getShortId } from '../../libs/utils'
import {
  BsSelectMultipleDataSelect,
  BsSelectMultipleProps,
} from './select-multiple.d'

const defaultPlaceholder = 'Sélection…'

function getAvailablePlayers(
  allPlayers: Array<Player>,
  alreadySelectedPlayers: Array<string>,
) {
  return allPlayers.reduce((result, currentPlayer) => {
    if (!alreadySelectedPlayers.includes(currentPlayer.id)) {
      result.push(currentPlayer)
    }

    return result
  }, [] as Array<Player>)
}

function getDataFromProps(props: BsSelectMultipleProps) {
  return {
    placeholder: defaultPlaceholder,
    availablePlayers: getAvailablePlayers(
      props.players || [],
      props.selectedPlayerIds || [],
    ),
    ...props,
    selectId: `bs-select-multiple-${getShortId()}`,
  } as BsSelectMultipleDataSelect
}

function onSelectionChange(
  setData: SetStoreFunction<BsSelectMultipleDataSelect>,
  data: BsSelectMultipleDataSelect,
) {
  setData(
    'availablePlayers',
    getAvailablePlayers(data.players || [], data.selectedPlayerIds || []),
  )

  if (data.onChange) {
    if (data.selectedPlayerIds && data.selectedPlayerIds.length) {
      data.onChange(data.selectedPlayerIds)
    } else {
      data.onChange([])
    }
  }
}

function onSelect(
  event: Event & { currentTarget: HTMLSelectElement; target: Element },
  data: BsSelectMultipleDataSelect,
  setData: SetStoreFunction<BsSelectMultipleDataSelect>,
) {
  const selectedId = event.currentTarget.value

  if (!data.selectedPlayerIds?.includes(selectedId)) {
    setData(
      'selectedPlayerIds',
      data.selectedPlayerIds?.length || 0,
      selectedId,
    )
  }

  onSelectionChange(setData, data)
}

function unselectPlayer(
  data: BsSelectMultipleDataSelect,
  setData: SetStoreFunction<BsSelectMultipleDataSelect>,
  player: Player,
) {
  if (!data.selectedPlayerIds || !data.selectedPlayerIds.includes(player.id)) {
    return
  }

  const newSelection = data.selectedPlayerIds.filter(
    currentId => currentId !== player.id,
  )

  setData('selectedPlayerIds', newSelection)

  onSelectionChange(setData, data)
}

function renderPlayerBadge(
  data: BsSelectMultipleDataSelect,
  setData: SetStoreFunction<BsSelectMultipleDataSelect>,
  player: Player,
) {
  return (
    <div class="inline-flex flex-nowrap items-center bg-white border border-gray-200 rounded-full p-1.5 dark:bg-neutral-900 dark:border-neutral-700">
      <span class="text-amber-600 dark:text-amber-400 p-2">
        {player.jersayNumber}
      </span>
      <div class="whitespace-nowrap text-sm font-medium text-gray-800 dark:text-white">
        {player.nicName
          ? player.nicName
          : `${player.firstName} ${player.lastName}`}
      </div>
      <button
        type="button"
        onClick={() => {
          unselectPlayer(unwrap(data), setData, player)
        }}
        class="ms-2.5 inline-flex justify-center items-center size-5 rounded-full text-gray-800 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:bg-neutral-700/50 dark:hover:bg-neutral-700 dark:text-neutral-400 cursor-pointer"
      >
        <svg
          class="shrink-0 size-3"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 6 6 18"></path>
          <path d="m6 6 12 12"></path>
        </svg>
      </button>
    </div>
  )
}

export default function BsSelectMultiple(props: BsSelectMultipleProps) {
  const [data, setData] = createStore(getDataFromProps(props))

  return (
    <>
      <Show when={data.label}>
        <label
          class="block text-sm font-medium mb-2 dark:text-white"
          for={data.selectId}
        >
          {data.label}
        </label>
      </Show>
      <div
        class="bg-white border border-gray-200 rounded-lg shadow-lg p-4 dark:bg-neutral-800 dark:border-neutral-700"
        role="alert"
        tabindex="-1"
        aria-labelledby="hs-discovery-label"
      >
        <div class="flex">
          <div class="ms-3">
            <h3
              id="hs-discovery-label"
              class="text-gray-800 font-semibold dark:text-white"
            >
              Joueur(s) selectionné(s):
            </h3>
            <div class="mt-2 text-sm text-gray-700 dark:text-neutral-400">
              <Show
                when={data.selectedPlayerIds?.length}
                fallback={'Aucun joueur sélectionné.'}
              >
                <For each={data.selectedPlayerIds}>
                  {id => {
                    const player = data.players?.find(
                      candidate => candidate.id === id,
                    )
                    if (!player) {
                      return
                    }

                    return renderPlayerBadge(data, setData, player)
                  }}
                </For>
              </Show>
            </div>
          </div>
        </div>
      </div>

      <select
        onChange={event => {
          onSelect(event, data, setData)
        }}
        disabled={data.availablePlayers.length === 0}
        class="py-3 px-4 pe-9 block w-full border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:placeholder-neutral-500 dark:focus:ring-neutral-600"
      >
        <option selected>
          {data.availablePlayers.length
            ? data.placeholder
            : 'Aucun joueur disponible.'}
        </option>
        <For each={data.availablePlayers}>
          {player => (
            <option value={player.id}>
              {`${player.jersayNumber} - ${player.nicName ? player.nicName : `${player.firstName} ${player.lastName}`}`}
            </option>
          )}
        </For>
      </select>
    </>
  )
}
