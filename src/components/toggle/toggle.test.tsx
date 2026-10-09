import { describe, expect, it, vi } from 'vitest'
import { renderView } from '../test-utils'
import BsToggle from './toggle'

function checkbox(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input')
  if (!input) {
    throw new Error('toggle input not rendered')
  }
  return input
}

describe('BsToggle', () => {
  it('reflects the value prop as the checked state', () => {
    // Guards toggle.tsx:29 (checked bound to props.value)
    const on = renderView(() => <BsToggle value={true} />)
    const off = renderView(() => <BsToggle value={false} />)

    expect(checkbox(on.container).checked).toBe(true)
    expect(checkbox(off.container).checked).toBe(false)
  })

  it('renders the label text', () => {
    // Guards toggle.tsx:25 (label text placement)
    const { container } = renderView(() => <BsToggle label="Titulaire" />)

    expect(container.querySelector('label')?.textContent).toContain('Titulaire')
  })

  it('applies the default base size class and the size prop when given', () => {
    // Guards toggle.tsx:20 (default size) and :30 (size class)
    const defaults = renderView(() => <BsToggle />)
    const large = renderView(() => <BsToggle size="lg" />)

    expect(checkbox(defaults.container).className).toBe('toggle toggle-primary toggle-base')
    expect(checkbox(large.container).className).toBe('toggle toggle-primary toggle-lg')
  })

  it('calls onChange with the new checked state when the user toggles it', () => {
    // Guards toggle.tsx:3-10 (onChange forwards target.checked)
    const onChange = vi.fn()
    const { container } = renderView(() => <BsToggle onChange={onChange} value={false} />)

    const input = checkbox(container)
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('does not throw and emits nothing when no onChange is provided', () => {
    // Guards toggle.tsx:4-6 (early return when no callback)
    const { container } = renderView(() => <BsToggle value={false} />)

    const input = checkbox(container)
    input.checked = true
    expect(() => input.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow()
  })
})
