import { createEffect, createSignal, mergeProps, Show } from 'solid-js'
import type { BsInlineEditableTitleProps } from './inline-editable-title.d'

const DEFAULT_MAX_LENGTH = 50

const HEADING_CLASSES = {
  h1: 'text-3xl font-extrabold',
  h2: 'text-2xl font-bold',
} as const

function adaptor(options: BsInlineEditableTitleProps): BsInlineEditableTitleProps {
  return mergeProps({ maxLength: DEFAULT_MAX_LENGTH }, options)
}

function makeDraftInputHandler(setDraft: (value: string) => void) {
  return (event: Event & { currentTarget: HTMLInputElement }) => {
    setDraft(event.currentTarget.value)
  }
}

export default function BsInlineEditableTitle(props: BsInlineEditableTitleProps) {
  const data = adaptor(props)
  const [isEditing, setIsEditing] = createSignal(false)
  const [draft, setDraft] = createSignal(data.value)

  const headingClass = HEADING_CLASSES[data.headingLevel]
  const editAriaLabel = `Modifier : ${data.ariaLabel}`

  // biome-ignore lint/suspicious/noUnassignedVariables: SolidJS assigns refs directly via the ref prop, so the variable is written outside regular JS.
  let inputRef!: HTMLInputElement

  createEffect(() => {
    if (isEditing() && inputRef) {
      inputRef.focus()
      inputRef.select()
    }
  })

  function startEditing() {
    setDraft(data.value)
    setIsEditing(true)
  }

  function save() {
    // Guard: onBlur re-fires when the input is unmounted after Enter saves
    if (!isEditing()) {
      return
    }
    const trimmed = draft().trim()
    data.onSave(trimmed)
    setIsEditing(false)
  }

  function cancel() {
    setDraft(data.value)
    setIsEditing(false)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      save()
    } else if (event.key === 'Escape') {
      cancel()
    }
  }

  function onDisplayKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      startEditing()
    }
  }

  return (
    <div class={headingClass}>
      <Show
        fallback={
          <button
            aria-label={editAriaLabel}
            class="cursor-pointer rounded px-1 hover:bg-base-200"
            onClick={startEditing}
            onKeyDown={onDisplayKeyDown}
            type="button"
          >
            {data.value || <i>{data.placeholder}</i>}
          </button>
        }
        when={isEditing()}
      >
        <input
          aria-label={data.ariaLabel}
          class="input input-sm w-full"
          maxlength={data.maxLength}
          onBlur={save}
          onInput={makeDraftInputHandler(setDraft)}
          onKeyDown={onKeyDown}
          ref={inputRef}
          type="text"
          value={draft()}
        />
      </Show>
    </div>
  )
}
