import { createSignal, Show } from 'solid-js'
import type { BsInlineEditableTitleProps } from './inline-editable-title.d'

const DEFAULT_MAX_LENGTH = 50

const HEADING_CLASSES = {
  h1: 'text-3xl font-extrabold',
  h2: 'text-2xl font-bold',
} as const

function adaptor(options: BsInlineEditableTitleProps): BsInlineEditableTitleProps {
  return {
    ...options,
    maxLength: options.maxLength ?? DEFAULT_MAX_LENGTH,
  }
}

export default function BsInlineEditableTitle(props: BsInlineEditableTitleProps) {
  const data = adaptor(props)
  const [isEditing, setIsEditing] = createSignal(false)
  const [draft, setDraft] = createSignal(data.value)

  const headingClass = HEADING_CLASSES[data.headingLevel]
  const editAriaLabel = `Modifier : ${data.ariaLabel}`

  function startEditing() {
    setDraft(data.value)
    setIsEditing(true)
  }

  function save() {
    const trimmed = draft().trim()
    setIsEditing(false)
    data.onSave(trimmed)
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
          autofocus
          class="input input-sm w-full"
          maxlength={data.maxLength}
          onBlur={save}
          onFocus={(event) => {
            event.target.select()
          }}
          onInput={(event) => {
            setDraft(event.currentTarget.value)
          }}
          onKeyDown={onKeyDown}
          type="text"
          value={draft()}
        />
      </Show>
    </div>
  )
}
