import { createComponent, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { renderView } from '../test-utils'
import BsCombobox, { canCreateOption, filterOptions } from './combobox'

describe('filterOptions', () => {
  it('returns all options when query is empty', () => {
    const options = ['Alpha', 'Beta', 'Gamma']
    expect(filterOptions(options, '')).toEqual(options)
  })

  it('returns all options when query is whitespace only', () => {
    const options = ['Alpha', 'Beta']
    expect(filterOptions(options, '   ')).toEqual(options)
  })

  it('filters case-insensitive substring match', () => {
    const options = ['Alpha', 'Beta', 'ALPHA']
    expect(filterOptions(options, 'alp')).toEqual(['Alpha', 'ALPHA'])
  })

  it('returns empty array when no match', () => {
    const options = ['Alpha', 'Beta']
    expect(filterOptions(options, 'xyz')).toEqual([])
  })

  it('preserves original option order', () => {
    const options = ['gamma', 'alpha', 'beta']
    expect(filterOptions(options, 'a')).toEqual(['gamma', 'alpha', 'beta']) // both alpha and gamma contain 'a'
  })

  it('does not mutate the input array', () => {
    const options = ['Alpha', 'Beta']
    const copy = [...options]
    filterOptions(options, 'alp')
    expect(options).toEqual(copy)
  })
})

describe('canCreateOption', () => {
  it('returns false for empty query', () => {
    expect(canCreateOption(['Alpha'], '')).toBe(false)
  })

  it('returns false for whitespace-only query', () => {
    expect(canCreateOption(['Alpha'], '   ')).toBe(false)
  })

  it('returns false when exact match exists (case-insensitive)', () => {
    expect(canCreateOption(['Alpha'], 'alpha')).toBe(false)
    expect(canCreateOption(['alpha'], 'Alpha')).toBe(false)
  })

  it('returns true for new label not in options', () => {
    expect(canCreateOption(['Alpha'], 'Beta')).toBe(true)
  })

  it('returns true when options is empty and query non-empty', () => {
    expect(canCreateOption([], 'New')).toBe(true)
  })
})

function queryRequired<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) {
    throw new Error(`Missing element for selector: ${selector}`)
  }
  return element
}

function getInput(): HTMLInputElement {
  return queryRequired<HTMLInputElement>('input[role="combobox"]')
}

function getListbox(): HTMLElement | null {
  return document.querySelector<HTMLElement>('ul[role="listbox"]')
}

function getOptionTexts(): string[] {
  return [...document.querySelectorAll('[role="option"]')].map((element) => element.textContent ?? '')
}

function typeInto(text: string): void {
  const input = getInput()
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function pressKey(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key })
  getInput().dispatchEvent(event)
  return event
}

function focusInput(): void {
  getInput().dispatchEvent(new Event('focus'))
}

/** Mounts the real component with a signal-backed value, so typing and selection flow back into props. */
function mountCombobox(options: string[], initialValue = '', label?: string) {
  const onChange = vi.fn<(value: string) => void>()
  const [value, setValue] = createSignal(initialValue)
  const handleChange = (next: string) => {
    onChange(next)
    setValue(next)
  }
  renderView(() =>
    createComponent(BsCombobox, {
      get label() {
        return label
      },
      onChange: handleChange,
      options,
      get value() {
        return value()
      },
    })
  )
  return { onChange }
}

describe('BsCombobox rendering', () => {
  it('renders the label only when one is provided', () => {
    mountCombobox(['Alpha'], '', 'Catégorie')
    expect(document.querySelector('label')?.textContent).toContain('Catégorie')
    expect(getInput().value).toBe('')
  })

  it('renders no label block without a label prop', () => {
    mountCombobox(['Alpha'])
    expect(document.querySelector('label .label')).toBeNull()
  })

  it('reflects the controlled value and placeholder in the input', () => {
    renderView(() =>
      createComponent(BsCombobox, { onChange: () => undefined, options: [], placeholder: 'Choisir', value: 'Beta' })
    )
    expect(getInput().value).toBe('Beta')
    expect(getInput().placeholder).toBe('Choisir')
  })

  it('keeps the dropdown closed until the input is focused or edited', () => {
    mountCombobox(['Alpha'])
    expect(getInput().getAttribute('aria-expanded')).toBe('false')
    expect(getListbox()).toBeNull()
  })
})

describe('BsCombobox opening and filtering', () => {
  it('opens on focus and lists every option', () => {
    mountCombobox(['Alpha', 'Beta'])
    focusInput()
    expect(getInput().getAttribute('aria-expanded')).toBe('true')
    expect(getOptionTexts()).toEqual(['Alpha', 'Beta'])
  })

  it('reports each typed value and filters the list as the user types', () => {
    const { onChange } = mountCombobox(['Alpha', 'Beta', 'Alphabet'])
    typeInto('alp')
    expect(onChange).toHaveBeenLastCalledWith('alp')
    expect(getInput().getAttribute('aria-expanded')).toBe('true')
    expect(getOptionTexts()).toEqual(['Alpha', 'Alphabet', 'Créer «alp»'])
  })

  it('shows the create row only when the typed text matches no option', () => {
    mountCombobox(['Alpha'])
    typeInto('alpha')
    expect(getOptionTexts()).toEqual(['Alpha'])

    typeInto('Gamma')
    expect(getOptionTexts()).toEqual(['Créer «Gamma»'])
  })

  it('trims the create label shown in the row', () => {
    mountCombobox(['Alpha'])
    typeInto('   Gamma   ')
    expect(getOptionTexts()).toEqual(['Créer «Gamma»'])
  })

  it('closes on Escape', () => {
    mountCombobox(['Alpha'])
    focusInput()
    pressKey('Escape')
    expect(getInput().getAttribute('aria-expanded')).toBe('false')
    expect(getListbox()).toBeNull()
  })

  it('resets the highlight to the first item when the dropdown reopens', () => {
    mountCombobox(['Alpha', 'Beta', 'Gamma'])
    focusInput()
    pressKey('ArrowDown')
    pressKey('ArrowDown')
    expect(getInput().getAttribute('aria-activedescendant')?.endsWith('option-2')).toBe(true)

    pressKey('Escape')
    focusInput()
    expect(getInput().getAttribute('aria-activedescendant')?.endsWith('option-0')).toBe(true)
  })
})

describe('BsCombobox pointer selection', () => {
  it('selects an option on click and closes the dropdown', () => {
    const mounted = mountCombobox(['Alpha', 'Beta'])
    const { onChange } = mounted
    focusInput()
    const [, beta] = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
    beta.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onChange).toHaveBeenCalledWith('Beta')
    expect(getInput().getAttribute('aria-expanded')).toBe('false')
  })

  it('creates the trimmed typed label when the create row is clicked', () => {
    const { onChange } = mountCombobox(['Alpha'])
    typeInto('  Gamma ')
    const createRow = queryRequired<HTMLElement>('[role="option"]')
    createRow.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onChange).toHaveBeenLastCalledWith('Gamma')
    expect(getListbox()).toBeNull()
  })

  it('closes when a pointerdown lands outside the component', () => {
    mountCombobox(['Alpha'])
    focusInput()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(getInput().getAttribute('aria-expanded')).toBe('false')
  })

  it('stays open when the pointerdown lands inside the component', () => {
    mountCombobox(['Alpha'])
    focusInput()
    getInput().dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(getInput().getAttribute('aria-expanded')).toBe('true')
  })
})

describe('BsCombobox keyboard navigation', () => {
  it('opens the dropdown on ArrowDown while closed and prevents the default scroll', () => {
    mountCombobox(['Alpha'])
    const event = pressKey('ArrowDown')
    expect(getInput().getAttribute('aria-expanded')).toBe('true')
    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores other keys while closed', () => {
    const { onChange } = mountCombobox(['Alpha'])
    const event = pressKey('a')
    expect(getInput().getAttribute('aria-expanded')).toBe('false')
    expect(event.defaultPrevented).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('moves the highlight down and clamps it on the last item', () => {
    mountCombobox(['Alpha', 'Beta'])
    focusInput()
    pressKey('ArrowDown')
    expect(getInput().getAttribute('aria-activedescendant')?.endsWith('option-1')).toBe(true)
    pressKey('ArrowDown')
    pressKey('ArrowDown')
    expect(getInput().getAttribute('aria-activedescendant')?.endsWith('option-1')).toBe(true)
  })

  it('moves the highlight up and clamps it on the first item', () => {
    mountCombobox(['Alpha', 'Beta'])
    focusInput()
    pressKey('ArrowUp')
    pressKey('ArrowUp')
    expect(getInput().getAttribute('aria-activedescendant')?.endsWith('option-0')).toBe(true)
  })

  it('marks only the highlighted option as selected', () => {
    mountCombobox(['Alpha', 'Beta'])
    focusInput()
    pressKey('ArrowDown')
    const [alpha, beta] = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
    expect(alpha.getAttribute('aria-selected')).toBe('false')
    expect(beta.getAttribute('aria-selected')).toBe('true')
  })

  it('selects the highlighted option on Enter', () => {
    const { onChange } = mountCombobox(['Alpha', 'Beta'])
    focusInput()
    pressKey('ArrowDown')
    const event = pressKey('Enter')
    expect(event.defaultPrevented).toBe(true)
    expect(onChange).toHaveBeenLastCalledWith('Beta')
    expect(getInput().getAttribute('aria-expanded')).toBe('false')
  })

  it('creates the trimmed label on Enter when the create row is highlighted', () => {
    const { onChange } = mountCombobox(['Alpha'])
    typeInto('  Gamma  ')
    pressKey('Enter')
    expect(onChange).toHaveBeenLastCalledWith('Gamma')
    expect(getListbox()).toBeNull()
  })

  it('does nothing on Enter when there is no option and nothing to create', () => {
    const { onChange } = mountCombobox([])
    focusInput()
    pressKey('Enter')
    expect(onChange).not.toHaveBeenCalled()
    expect(getInput().getAttribute('aria-expanded')).toBe('true')
  })

  it('never emits a created label for whitespace-only input on Enter', () => {
    const { onChange } = mountCombobox([])
    typeInto('   ')
    onChange.mockClear()
    pressKey('Enter')
    expect(onChange).not.toHaveBeenCalled()
    expect(getInput().getAttribute('aria-expanded')).toBe('true')
  })

  it('points aria-activedescendant at nothing while closed', () => {
    mountCombobox(['Alpha'])
    expect(getInput().hasAttribute('aria-activedescendant')).toBe(false)
  })
})
