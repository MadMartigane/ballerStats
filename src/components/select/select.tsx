import { For, Show, mergeProps } from 'solid-js'
import { createStore } from 'solid-js/store'
import { getShortId } from '../../libs/utils'
import type { BsSelectOnChangeEvent, BsSelectProps } from './select.d'

const defaultOptions: BsSelectProps = {
  default: null,
  disabled: false,
  datas: [],
}

function onChange(event: BsSelectOnChangeEvent, options: BsSelectProps) {
  event.stopPropagation()

  if (options.onValueChange) {
    const target = event.target || event.currentTarget || { value: '' }
    options.onValueChange(target.value)
  }

  if (options.onChange) {
    options.onChange(event)
  }
}

function adapter(options: BsSelectProps): BsSelectProps {
  const random = getShortId()
  const id = `bs-select-${random}`

  return mergeProps(
    {
      ...defaultOptions,
      id,
    },
    options,
  )
}

function renderDaisy(props: BsSelectProps) {
  const options = adapter(props)
  const [datas] = createStore(props.datas)

  return (
    <div class="w-full flex">
      <Show when={options.label}>
        <div class="label w-1/3">
          <span class="w-full">{options.label}</span>
        </div>
      </Show>
      <div class={options.label ? 'w-2/3' : 'w-full'}>
        <select
          class="select select-bordered w-full"
          id={options.id}
          disabled={options.disabled}
          onChange={event => onChange(event, options)}
        >
          <Show
            when={!options.value && !options.default && options.placeholder}
          >
            <option selected>{options.placeholder}</option>
          </Show>

          <For each={datas}>
            {data => (
              <option
                value={data.value}
                selected={data.value === (options.value || options.default)}
              >
                {data.label}
              </option>
            )}
          </For>
        </select>
      </div>
    </div>
  )
}

export default function BsSelect(options: BsSelectProps) {
  const newOpions = adapter(options)

  return renderDaisy(newOpions)
}
