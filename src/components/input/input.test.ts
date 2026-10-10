import { createComponent } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderView } from '../test-utils'
import BsInput from './input'

const DEBOUNCE_MS = 300

interface MountOptions {
  disabled?: boolean
  label?: string
  maxLength?: number
  onBlur?: () => void
  onChange?: (value: string) => void
  onFocus?: () => void
  placeholder?: string
  type?: 'text' | 'email'
  value?: string
}

function mountInput(options: MountOptions = {}): HTMLInputElement {
  renderView(() => createComponent(BsInput, options))
  const input = document.querySelector<HTMLInputElement>('input')
  if (!input) {
    throw new Error('Input was not rendered')
  }
  return input
}

function fire(input: HTMLInputElement, type: string, init?: EventInit): void {
  input.dispatchEvent(new Event(type, { bubbles: true, ...init }))
}

function typeValue(input: HTMLInputElement, value: string): void {
  input.value = value
  fire(input, 'input')
}

describe('BsInput rendering', () => {
  it('renders the label block only when a label is provided', () => {
    mountInput({ label: 'Nom' })
    expect(document.querySelector('label .label')?.textContent).toBe('Nom')
  })

  it('omits the label block and uses full width without a label', () => {
    mountInput()
    expect(document.querySelector('label .label')).toBeNull()
    expect(document.querySelector('label > div')?.className).toContain('w-full')
  })

  it('uses the two-thirds column width when a label is present', () => {
    mountInput({ label: 'Nom' })
    expect(document.querySelector('label > div:last-child')?.className).toContain('w-2/3')
  })

  it('defaults the input type to text', () => {
    expect(mountInput().type).toBe('text')
  })

  it('applies email type, placeholder, maxLength and disabled state', () => {
    const input = mountInput({ disabled: true, maxLength: 12, placeholder: 'x@y.fr', type: 'email' })
    expect(input.type).toBe('email')
    expect(input.placeholder).toBe('x@y.fr')
    expect(input.maxLength).toBe(12)
    expect(input.disabled).toBe(true)
  })

  it('renders an empty string when the value is undefined', () => {
    expect(mountInput().value).toBe('')
  })

  it('reflects a provided value', () => {
    expect(mountInput({ value: 'Alpha' }).value).toBe('Alpha')
  })
})

describe('BsInput change events', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('commits the value immediately on change', () => {
    const onChange = vi.fn<(value: string) => void>()
    const input = mountInput({ onChange })
    input.value = 'Beta'
    fire(input, 'change')
    expect(onChange).toHaveBeenCalledWith('Beta')
  })

  it('does not throw on change when no onChange is provided', () => {
    const input = mountInput()
    input.value = 'Beta'
    expect(() => fire(input, 'change')).not.toThrow()
  })

  it('debounces input events so a burst commits once with the latest value', () => {
    const onChange = vi.fn<(value: string) => void>()
    const input = mountInput({ onChange })
    typeValue(input, 'a')
    vi.advanceTimersByTime(DEBOUNCE_MS - 1)
    typeValue(input, 'ab')
    vi.advanceTimersByTime(DEBOUNCE_MS - 1)
    typeValue(input, 'abc')
    expect(onChange).not.toHaveBeenCalled()

    vi.advanceTimersByTime(DEBOUNCE_MS)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('abc')
  })

  it('does not commit an input before the debounce delay elapses', () => {
    const onChange = vi.fn<(value: string) => void>()
    const input = mountInput({ onChange })
    typeValue(input, 'x')
    vi.advanceTimersByTime(DEBOUNCE_MS - 1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('cancels a pending debounced commit when change fires', () => {
    const onChange = vi.fn<(value: string) => void>()
    const input = mountInput({ onChange })
    typeValue(input, 'pending')
    input.value = 'final'
    fire(input, 'change')
    vi.advanceTimersByTime(DEBOUNCE_MS * 2)
    expect(onChange.mock.calls).toEqual([['final']])
  })
})

describe('BsInput blur, focus and enter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes a pending debounced value on blur and then calls onBlur', () => {
    const onChange = vi.fn<(value: string) => void>()
    const onBlur = vi.fn<() => void>()
    const input = mountInput({ onBlur, onChange })
    typeValue(input, 'typed')
    input.dispatchEvent(new FocusEvent('blur'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('typed')
    expect(onBlur).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(DEBOUNCE_MS * 2)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('does not commit on blur when nothing is pending', () => {
    const onChange = vi.fn<(value: string) => void>()
    const input = mountInput({ onChange })
    input.dispatchEvent(new FocusEvent('blur'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('calls onFocus when the input receives focus', () => {
    const onFocus = vi.fn<() => void>()
    const input = mountInput({ onFocus })
    fire(input, 'focus')
    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  it('commits immediately on Enter with the current value', () => {
    const onChange = vi.fn<(value: string) => void>()
    const input = mountInput({ onChange })
    typeValue(input, 'entered')
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    expect(onChange).toHaveBeenCalledWith('entered')
    vi.advanceTimersByTime(DEBOUNCE_MS * 2)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('ignores keys other than Enter', () => {
    const onChange = vi.fn<(value: string) => void>()
    const input = mountInput({ onChange })
    typeValue(input, 'typing')
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
