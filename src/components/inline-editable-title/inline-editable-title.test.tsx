import { describe, expect, it, vi } from 'vitest'
import { renderView } from '../test-utils'
import BsInlineEditableTitle from './inline-editable-title'

const BASE_PROPS = {
  ariaLabel: 'Nom du joueur',
  headingLevel: 'h1' as const,
  onSave: () => undefined,
  placeholder: 'Sans nom',
  value: 'Marie',
}

function displayButton(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector('button')
  if (!button) {
    throw new Error('display button not rendered')
  }
  return button
}

function startEditing(container: HTMLElement): HTMLInputElement {
  displayButton(container).click()
  const input = container.querySelector('input')
  if (!input) {
    throw new Error('input not rendered after click')
  }
  return input
}

describe('BsInlineEditableTitle', () => {
  it('shows the value in a button labelled for editing', () => {
    // Guards inline-editable-title.tsx:79 and :85 (aria-label and displayed value)
    const { container } = renderView(() => <BsInlineEditableTitle {...BASE_PROPS} />)

    const button = displayButton(container)
    expect(button.textContent).toBe('Marie')
    expect(button.getAttribute('aria-label')).toBe('Modifier : Nom du joueur')
  })

  it('shows the placeholder when the value is empty', () => {
    // Guards inline-editable-title.tsx:85 (placeholder fallback)
    const { container } = renderView(() => <BsInlineEditableTitle {...BASE_PROPS} value="" />)

    expect(displayButton(container).querySelector('i')?.textContent).toBe('Sans nom')
  })

  it('applies the heading class matching the headingLevel prop', () => {
    // Guards inline-editable-title.tsx:6-9 and :26 (heading level to class map)
    const h1 = renderView(() => <BsInlineEditableTitle {...BASE_PROPS} headingLevel="h1" />)
    const h2 = renderView(() => <BsInlineEditableTitle {...BASE_PROPS} headingLevel="h2" />)

    expect((h1.container.firstElementChild as HTMLElement).className).toBe('text-3xl font-extrabold')
    expect((h2.container.firstElementChild as HTMLElement).className).toBe('text-2xl font-bold')
  })

  it('swaps to an input seeded with the current value on click', () => {
    // Guards inline-editable-title.tsx:39-42 (startEditing) and :90-100 (input rendering)
    const { container } = renderView(() => <BsInlineEditableTitle {...BASE_PROPS} />)

    const input = startEditing(container)
    expect(input.value).toBe('Marie')
    expect(input.getAttribute('aria-label')).toBe('Nom du joueur')
    expect(container.querySelector('button')).toBeNull()
  })

  it('saves the trimmed draft when Enter is pressed', () => {
    // Guards inline-editable-title.tsx:44-52 (save trims) and :60-61 (Enter saves)
    const onSave = vi.fn()
    const { container } = renderView(() => <BsInlineEditableTitle {...BASE_PROPS} onSave={onSave} />)

    const input = startEditing(container)
    input.value = '  Lena  '
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('Lena')
    expect(container.querySelector('button')).not.toBeNull()
  })

  it('discards the draft and does not save when Escape is pressed', () => {
    // Guards inline-editable-title.tsx:54-57 (cancel) and :62-63 (Escape cancels)
    const onSave = vi.fn()
    const { container } = renderView(() => <BsInlineEditableTitle {...BASE_PROPS} onSave={onSave} />)

    const input = startEditing(container)
    input.value = 'Brouillon'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(displayButton(container).textContent).toBe('Marie')
  })

  it('saves on blur while editing', () => {
    // Guards inline-editable-title.tsx:94 (onBlur wired to save)
    const onSave = vi.fn()
    const { container } = renderView(() => <BsInlineEditableTitle {...BASE_PROPS} onSave={onSave} />)

    const input = startEditing(container)
    input.value = 'Camille'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new FocusEvent('blur'))

    expect(onSave).toHaveBeenCalledWith('Camille')
  })

  it('does not save twice when blur follows an Enter save', () => {
    // Guards inline-editable-title.tsx:46-48 (isEditing guard against double save)
    const onSave = vi.fn()
    const { container } = renderView(() => <BsInlineEditableTitle {...BASE_PROPS} onSave={onSave} />)

    const input = startEditing(container)
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    input.dispatchEvent(new FocusEvent('blur'))

    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('starts editing from the keyboard on Enter or Space and prevents default', () => {
    // Guards inline-editable-title.tsx:67-72 (display keydown opens editor)
    const { container } = renderView(() => <BsInlineEditableTitle {...BASE_PROPS} />)

    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: ' ' })
    displayButton(container).dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(container.querySelector('input')).not.toBeNull()
  })

  it('enforces the maxLength prop on the input', () => {
    // Guards inline-editable-title.tsx:12 (default 50) and :93 (maxlength attribute)
    const defaults = renderView(() => <BsInlineEditableTitle {...BASE_PROPS} />)
    const custom = renderView(() => <BsInlineEditableTitle {...BASE_PROPS} maxLength={8} />)

    expect(startEditing(defaults.container).getAttribute('maxlength')).toBe('50')
    expect(startEditing(custom.container).getAttribute('maxlength')).toBe('8')
  })
})
