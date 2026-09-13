import { createUniqueId, mergeProps, onCleanup, Show } from 'solid-js'
import type { BsInputOnChangeEvent, BsInputProps } from './input.d'

const INPUT_DEBOUNCE_MS = 300

const defaultOptions = {
  type: 'text' as const,
}

function adapter(options: BsInputProps): BsInputProps {
  return mergeProps(defaultOptions, { id: createUniqueId() }, options)
}

function readInputValue(event: Event & { currentTarget: HTMLInputElement; target?: EventTarget | null }): string {
  if (event.target && 'value' in event.target && typeof event.target.value === 'string') {
    return event.target.value
  }
  return event.currentTarget.value
}

export default function BsInput(options: BsInputProps) {
  const props = adapter(options)
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  // biome-ignore lint/suspicious/noUnassignedVariables: SolidJS assigns refs directly via the ref prop
  let inputEl: HTMLInputElement | undefined

  const commit = (value: string) => {
    const callback = props.onChange
    if (!callback) {
      return
    }
    callback(value)
  }

  const flush = (value: string) => {
    if (debounceTimer === undefined) {
      return
    }
    clearTimeout(debounceTimer)
    debounceTimer = undefined
    commit(value)
  }

  onCleanup(() => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer)
    }
  })

  const handleChange = (event: BsInputOnChangeEvent) => {
    event.stopPropagation()
    const value = readInputValue(event)
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer)
      debounceTimer = undefined
    }
    commit(value)
  }

  const handleInput = (event: BsInputOnChangeEvent) => {
    event.stopPropagation()
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      commit(inputEl?.value ?? readInputValue(event))
    }, INPUT_DEBOUNCE_MS)
  }

  const handleBlur = (event: FocusEvent & { currentTarget: HTMLInputElement }) => {
    flush(event.currentTarget.value)
    const { onBlur } = props
    if (onBlur) {
      onBlur()
    }
  }

  const handleKeyDown = (event: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
    if (event.key !== 'Enter') {
      return
    }
    flush(event.currentTarget.value)
  }

  return (
    <label class="flex w-full" for={props.id}>
      <Show when={props.label}>
        <div class="label w-1/3">{props.label}</div>
      </Show>
      <div class={props.label ? 'w-2/3' : 'w-full'}>
        <input
          class="input w-full"
          id={props.id}
          maxLength={props.maxLength}
          onBlur={handleBlur}
          onChange={handleChange}
          onFocus={props.onFocus}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder}
          ref={inputEl}
          type={props.type}
          value={props.value || ''}
        />
      </div>
    </label>
  )
}
