import { createComponent } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { renderView } from '../test-utils'
import BsSelect from './select'

const DATAS = [
  { label: 'Mère', value: 'mother' },
  { label: 'Père', value: 'father' },
  { label: 'Autre', value: 'other' },
]

function mountSelect(options: Record<string, unknown> = {}): HTMLSelectElement {
  renderView(() => createComponent(BsSelect, { datas: DATAS, ...options } as Parameters<typeof BsSelect>[0]))
  const select = document.querySelector<HTMLSelectElement>('select')
  if (!select) {
    throw new Error('Select was not rendered')
  }
  return select
}

function optionValues(select: HTMLSelectElement): string[] {
  return [...select.options].map((option) => option.value)
}

describe('BsSelect rendering', () => {
  it('renders one option per data entry, in order, with its label', () => {
    const select = mountSelect()
    expect(optionValues(select)).toEqual(['mother', 'father', 'other'])
    expect(select.options[1].textContent).toBe('Père')
  })

  it('renders the label block only when a label is provided', () => {
    mountSelect({ label: 'Relation' })
    expect(document.querySelector('.label')?.textContent).toBe('Relation')
  })

  it('omits the label block and uses full width without a label', () => {
    mountSelect()
    expect(document.querySelector('.label')).toBeNull()
    expect(document.querySelector('select')?.parentElement?.className).toContain('w-full')
  })

  it('uses the two-thirds column width when a label is present', () => {
    mountSelect({ label: 'Relation' })
    expect(document.querySelector('select')?.parentElement?.className).toContain('w-2/3')
  })

  it('applies disabled state to the native select', () => {
    expect(mountSelect({ disabled: true }).disabled).toBe(true)
  })

  it('selects the option matching value', () => {
    expect(mountSelect({ value: 'father' }).value).toBe('father')
  })

  it('falls back to the default option when value is absent', () => {
    expect(mountSelect({ default: 'other' }).value).toBe('other')
  })

  it('prefers value over default when both are set', () => {
    expect(mountSelect({ default: 'other', value: 'mother' }).value).toBe('mother')
  })

  it('shows the placeholder as a first option when nothing is selected', () => {
    const select = mountSelect({ placeholder: 'Choisir…' })
    expect(select.options[0].textContent).toBe('Choisir…')
    expect(select.options.length).toBe(DATAS.length + 1)
  })

  it('hides the placeholder once a value is chosen', () => {
    const select = mountSelect({ placeholder: 'Choisir…', value: 'mother' })
    expect(select.options.length).toBe(DATAS.length)
    expect(optionValues(select)).not.toContain('')
  })

  it('hides the placeholder when a default is set', () => {
    const select = mountSelect({ default: 'mother', placeholder: 'Choisir…' })
    expect(select.options.length).toBe(DATAS.length)
  })

  it('renders no placeholder option when placeholder is null', () => {
    expect(mountSelect({ placeholder: null }).options.length).toBe(DATAS.length)
  })

  it('renders no options when datas is empty', () => {
    expect(mountSelect({ datas: [] }).options.length).toBe(0)
  })
})

describe('BsSelect change events', () => {
  it('calls onValueChange with the selected value', () => {
    const onValueChange = vi.fn<(value: string) => void>()
    const select = mountSelect({ onValueChange })
    select.value = 'father'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith('father')
  })

  it('calls onChange with the raw event', () => {
    const onChange = vi.fn<(event: Event) => void>()
    const select = mountSelect({ onChange })
    select.value = 'other'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].type).toBe('change')
  })

  it('calls both callbacks on one change', () => {
    const onValueChange = vi.fn<(value: string) => void>()
    const onChange = vi.fn<(event: Event) => void>()
    const select = mountSelect({ onChange, onValueChange })
    select.value = 'mother'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(onValueChange).toHaveBeenCalledWith('mother')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('does not throw on change when neither callback is provided', () => {
    const select = mountSelect()
    select.value = 'father'
    expect(() => select.dispatchEvent(new Event('change', { bubbles: true }))).not.toThrow()
  })
})
