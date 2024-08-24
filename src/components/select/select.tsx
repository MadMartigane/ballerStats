import { For, Show } from 'solid-js'
import { getShortId } from '../../libs/utils'
import { BsSelectOnChangeEvent, BsSelectProps } from './select.d'

const defaultOptions: BsSelectProps = {
  default: null,
  datas: [],
}

function onChange(event: BsSelectOnChangeEvent, options: BsSelectProps) {
  event.stopPropagation()

  const target = event.target || event.currentTarget || { value: '' }
  options.value = target.value

  if (options.onValueChange) {
    options.onValueChange(options.value)
  }

  if (options.onChange) {
    options.onChange(event)
  }
}

function adapter(options: BsSelectProps): BsSelectProps {
  const random = getShortId()
  const id = `bs-select-${random}`

  return {
    ...defaultOptions,
    id,
    ...options,
  }
}

function renderDaisy(options: BsSelectProps) {
  return (
    <label class="form-control w-full">
      <div class="label">
        <Show when={options.label}>
          <span class="w-full max-w-xs">{options.label}</span>
        </Show>
        <select
          class="select select-bordered w-full select-ghost"
          id={options.id}
          onChange={event => onChange(event, options)}
        >
          <Show
            when={!options.value && !options.default && options.placeholder}
          >
            <option selected>{options.placeholder}</option>
          </Show>

          <For each={options.datas}>
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
    </label>
  )
}

export default function BsSelect(options: BsSelectProps) {
  const newOpions = adapter(options)

  return renderDaisy(newOpions)
}
