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
    <label class="form-control w-full">
      <div class="label">
        <Show when={options.label}>
          <span class="w-full max-w-xs">{options.label}</span>
        </Show>
        <select
          class="select select-bordered w-full select-ghost"
          id={options.id}
          disabled={options.disabled}
          onChange={(event) => onChange(event, options)}
        >
          <Show
            when={!options.value && !options.default && options.placeholder}
          >
            <option selected>{options.placeholder}</option>
          </Show>

          <For each={datas}>
            {(data) => (
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
    </label>
  )
}

export default function BsSelect(options: BsSelectProps) {
  const newOpions = adapter(options)

  return renderDaisy(newOpions)
}
