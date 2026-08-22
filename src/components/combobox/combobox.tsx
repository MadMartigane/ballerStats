import { createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show } from 'solid-js'
import type { BsComboboxProps } from './combobox.d'

/** Case-insensitive substring filter. Returns options containing the query. */
export function filterOptions(options: string[], query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) {
    return [...options]
  }
  return options.filter((opt) => opt.toLowerCase().includes(q))
}

/**
 * Whether the query should trigger the "Create" affordance.
 * True when query is non-empty (after trim) AND no existing option
 * matches case-insensitively.
 */
export function canCreateOption(options: string[], query: string): boolean {
  const q = query.trim()
  if (!q) {
    return false
  }
  const lower = q.toLowerCase()
  return !options.some((opt) => opt.toLowerCase() === lower)
}

export default function BsCombobox(props: BsComboboxProps) {
  const [isOpen, setIsOpen] = createSignal(false)
  const [highlight, setHighlight] = createSignal(0)
  const inputId = props.id ?? createUniqueId()
  const listboxId = createUniqueId()
  // biome-ignore lint/suspicious/noUnassignedVariables: SolidJS assigns refs directly via the ref prop, so the variable is written outside regular JS.
  let containerRef: HTMLDivElement | undefined

  const filtered = createMemo(() => filterOptions(props.options, props.value))
  const canCreate = createMemo(() => canCreateOption(props.options, props.value))

  // Total visible items = filtered options + optional create item
  const totalItems = createMemo(() => filtered().length + (canCreate() ? 1 : 0))

  onMount(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const { target } = event
      if (containerRef && target instanceof Node && !containerRef.contains(target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    onCleanup(() => document.removeEventListener('pointerdown', handlePointerDown))
  })

  const selectOption = (opt: string) => {
    props.onChange(opt)
    setIsOpen(false)
  }

  const createNew = () => {
    const trimmed = props.value.trim()
    if (trimmed) {
      props.onChange(trimmed)
      setIsOpen(false)
    }
  }

  const handleInput = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    props.onChange(event.currentTarget.value)
    setIsOpen(true)
  }

  const handleOptionClick = (event: MouseEvent & { currentTarget: HTMLElement }) => {
    const { value } = event.currentTarget.dataset
    if (value !== undefined) {
      selectOption(value)
    }
  }

  const openDropdown = () => {
    setHighlight(0)
    setIsOpen(true)
  }

  const closeDropdown = () => setIsOpen(false)

  const onKeyDown = (e: KeyboardEvent) => {
    if (!isOpen()) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        openDropdown()
        e.preventDefault()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => {
        const max = totalItems() - 1
        return max < 0 ? 0 : Math.min(h + 1, max)
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = highlight()
      if (idx < filtered().length) {
        selectOption(filtered()[idx])
      } else if (canCreate()) {
        createNew()
      }
    } else if (e.key === 'Escape') {
      closeDropdown()
    }
  }

  const optionId = (i: number) => `${listboxId}-option-${i}`
  const listboxClass =
    'menu dropdown-content absolute top-full right-0 z-50 mt-1 w-2/3 rounded-box bg-base-200 shadow-lg'

  return (
    <div class="relative flex w-full" ref={containerRef}>
      <label class="flex w-full">
        <Show when={props.label}>
          <div class="label w-1/3">{props.label}</div>
        </Show>
        <div class="relative w-2/3">
          <input
            aria-activedescendant={isOpen() ? optionId(highlight()) : undefined}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={isOpen()}
            class="input input-bordered w-full"
            id={inputId}
            onFocus={openDropdown}
            onInput={handleInput}
            onKeyDown={onKeyDown}
            placeholder={props.placeholder ?? ''}
            role="combobox"
            type="text"
            value={props.value}
          />
        </div>
      </label>
      <Show when={isOpen()}>
        {/* Dropdown list */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: using ul role="listbox" as the combobox listbox container. */}
        <ul class={listboxClass} id={listboxId} role="listbox">
          <For each={filtered()}>
            {(opt, i) => (
              // biome-ignore lint/a11y/useFocusableInteractive: listbox options stay unfocusable; the combobox input tracks the active option via aria-activedescendant.
              // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection is handled by the combobox input's onKeyDown.
              <li
                aria-selected={highlight() === i()}
                class={highlight() === i() ? 'bg-primary/20' : ''}
                data-value={opt}
                id={optionId(i())}
                onClick={handleOptionClick}
                // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: ARIA listbox option pattern; role="option" is required for the combobox pattern.
                role="option"
              >
                <span>{opt}</span>
              </li>
            )}
          </For>
          <Show when={canCreate()}>
            <li aria-hidden="true" class="my-1 border-base-300 border-t" />
            {/* biome-ignore lint/a11y/useFocusableInteractive: listbox options stay unfocusable; the combobox input tracks the active option via aria-activedescendant. */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection is handled by the combobox input's onKeyDown. */}
            <li
              aria-selected={highlight() === filtered().length}
              class={highlight() === filtered().length ? 'bg-primary/20' : ''}
              id={optionId(filtered().length)}
              onClick={createNew}
              // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: ARIA listbox option pattern; role="option" is required for the combobox pattern.
              role="option"
            >
              <span>Créer «{props.value.trim()}»</span>
            </li>
          </Show>
        </ul>
      </Show>
    </div>
  )
}
