import { Show } from 'solid-js'
import type { BsDatePickerOnChangeEvent, BsDatePickerProps } from './date-picker.d'

let debounceOnInput: number | null

function onInput(event: BsDatePickerOnChangeEvent, callback?: (value: string) => void) {
  if (!callback) {
    return
  }

  if (debounceOnInput) {
    clearTimeout(debounceOnInput)
  }

  debounceOnInput = setTimeout(() => {
    onChange(event, callback)
    debounceOnInput = null
  }, 300)
}

function onChange(event: BsDatePickerOnChangeEvent, callback?: (value: string) => void) {
  if (!callback) {
    return
  }

  event.stopPropagation()
  const target = event.target || event.currentTarget || { value: '' }
  callback(target.value)
}

export function BsDatePicker(props: BsDatePickerProps) {
  return (
    <label class="w-full flex">
      <Show when={props.label}>
        <span class="label w-1/3">{props.label}</span>
      </Show>
      <div class={props.label ? 'w-2/3' : 'w-full'}>
        <input
          class="input w-full"
          type={props.withTime ? 'datetime-local' : 'date'}
          placeholder={props.placeholder || ''}
          value={props.value || ''}
          onChange={(event) => onChange(event, props.onChange)}
          onInput={(event) => onInput(event, props.onChange)}
        />
      </div>
    </label>
  )
}
