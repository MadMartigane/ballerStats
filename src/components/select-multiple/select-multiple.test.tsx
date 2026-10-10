import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderView } from '../test-utils'
import BsSelectMultiple from './select-multiple'
import type { BsSelectDataSet } from './select-multiple.d'

function makeDataSets(): BsSelectDataSet[] {
  return [
    { badge: <span>A</span>, label: 'Alice', value: 'p1' },
    { badge: <span>B</span>, label: 'Bob', value: 'p2' },
    { badge: <span>C</span>, label: 'Chloé', value: 'p3' },
  ]
}

function requireSelect(container: HTMLElement): HTMLSelectElement {
  const select = container.querySelector<HTMLSelectElement>('select')
  if (!select) {
    throw new Error('Select not found')
  }
  return select
}

function choose(select: HTMLSelectElement, value: string) {
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

function removeButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('.badge button'))
}

describe('BsSelectMultiple', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the empty message when nothing is selected', () => {
    const { container } = renderView(() => <BsSelectMultiple data={makeDataSets()} />)

    expect(container.textContent).toContain('Aucun joueur sélectionné.')
    expect(removeButtons(container)).toHaveLength(0)
  })

  it('renders a badge per selected id, skipping ids missing from the data', () => {
    const { container } = renderView(() => (
      <BsSelectMultiple data={makeDataSets()} selectedIds={['p1', 'ghost', 'p3']} />
    ))

    const badges = container.querySelectorAll('.badge')
    expect(badges).toHaveLength(2)
    expect(badges[0]?.textContent).toContain('A')
    expect(badges[1]?.textContent).toContain('C')
  })

  it('shows the label above the select when one is provided', () => {
    const { container } = renderView(() => <BsSelectMultiple data={makeDataSets()} label="Équipe" />)

    expect(container.querySelector('label')?.textContent).toBe('Équipe')
  })

  it('offers only unselected players, with a placeholder first', () => {
    const { container } = renderView(() => (
      <BsSelectMultiple data={makeDataSets()} placeholder="Choisir" selectedIds={['p2']} />
    ))

    const options = Array.from(requireSelect(container).querySelectorAll('option')).map((option) => option.value)
    expect(options).toEqual(['', 'p1', 'p3'])
  })

  it('shows the no-player label and disables the select when every player is selected', () => {
    const { container } = renderView(() => (
      <BsSelectMultiple data={makeDataSets()} placeholder="Choisir" selectedIds={['p1', 'p2', 'p3']} />
    ))

    const select = requireSelect(container)
    expect(select.disabled).toBe(true)
    expect(select.querySelector('option')?.textContent).toBe('Aucun joueur disponible.')
  })

  it('disables the select when only one choice would remain', () => {
    const { container } = renderView(() => <BsSelectMultiple data={makeDataSets()} selectedIds={['p1', 'p2']} />)

    expect(requireSelect(container).disabled).toBe(true)
  })

  it('adds the chosen player and reports the new selection', () => {
    const onChange = vi.fn()
    const { container } = renderView(() => <BsSelectMultiple data={makeDataSets()} onChange={onChange} />)

    choose(requireSelect(container), 'p2')

    expect(onChange).toHaveBeenLastCalledWith(['p2'])
    expect(container.querySelectorAll('.badge')).toHaveLength(1)
    expect(container.textContent).not.toContain('Aucun joueur sélectionné.')
  })

  it('removes a player when its badge close button is clicked', () => {
    const onChange = vi.fn()
    const { container } = renderView(() => (
      <BsSelectMultiple data={makeDataSets()} onChange={onChange} selectedIds={['p1', 'p3']} />
    ))

    removeButtons(container)[0]?.click()

    expect(onChange).toHaveBeenLastCalledWith(['p3'])
    expect(container.querySelectorAll('.badge')).toHaveLength(1)
    expect(container.querySelector('.badge')?.textContent).toContain('C')
  })

  it('reports an empty selection after the last badge is removed', () => {
    const onChange = vi.fn()
    const { container } = renderView(() => (
      <BsSelectMultiple data={makeDataSets()} onChange={onChange} selectedIds={['p2']} />
    ))

    removeButtons(container)[0]?.click()

    expect(onChange).toHaveBeenLastCalledWith([])
    expect(container.textContent).toContain('Aucun joueur sélectionné.')
  })

  it('keeps a single badge when the chosen player is already selected', () => {
    const { container } = renderView(() => <BsSelectMultiple data={makeDataSets()} selectedIds={['p1']} />)

    const select = requireSelect(container)
    select.value = 'p1'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    expect(container.querySelectorAll('.badge')).toHaveLength(1)
  })

  it('ignores the placeholder option and still accepts a later real selection', () => {
    const onChange = vi.fn()
    const { container } = renderView(() => (
      <BsSelectMultiple data={makeDataSets()} onChange={onChange} placeholder="Choisir" />
    ))

    const select = requireSelect(container)
    choose(select, '')

    expect(onChange).not.toHaveBeenCalled()
    expect(container.querySelectorAll('.badge')).toHaveLength(0)
    expect(container.textContent).toContain('Aucun joueur sélectionné.')

    choose(select, 'p2')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith(['p2'])
    expect(container.querySelectorAll('.badge')).toHaveLength(1)
    expect(container.textContent).not.toContain('Aucun joueur sélectionné.')
  })
})
