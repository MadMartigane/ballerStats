import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderView } from '../test-utils'
import { GLOSSARY_COLUMNS } from './stat-columns'
import { BsStatsLegend } from './stats-legend'

const ENTRY_WITH_EXPLANATION = GLOSSARY_COLUMNS.find((entry) => entry.glossary.explanation)
const [FIRST_ENTRY] = GLOSSARY_COLUMNS

function stubDialog() {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
  }
}

function unstubDialog() {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
}

function requireDialog(container: HTMLElement): HTMLDialogElement {
  const dialog = container.querySelector<HTMLDialogElement>('dialog')
  if (!dialog) {
    throw new Error('Legend dialog not found')
  }
  return dialog
}

function requireLearnMoreButton(container: HTMLElement, fullName: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="En savoir plus sur ${fullName}"]`)
  if (!button) {
    throw new Error(`Learn-more button for ${fullName} not found`)
  }
  return button
}

describe('BsStatsLegend', () => {
  beforeEach(() => {
    stubDialog()
  })

  afterEach(() => {
    unstubDialog()
    vi.restoreAllMocks()
  })

  it('renders one list row per glossary column with its label and full name', () => {
    const { container } = renderView(() => <BsStatsLegend />)

    const rows = container.querySelectorAll('li')
    expect(rows).toHaveLength(GLOSSARY_COLUMNS.length)
    expect(rows[0]?.textContent).toContain(FIRST_ENTRY.label)
    expect(rows[0]?.textContent).toContain(FIRST_ENTRY.glossary.fullName)
  })

  it('renders a learn-more button only for entries that have an explanation', () => {
    const { container } = renderView(() => <BsStatsLegend />)

    const buttons = container.querySelectorAll('button[aria-label^="En savoir plus"]')
    const withExplanation = GLOSSARY_COLUMNS.filter((entry) => entry.glossary.explanation)
    expect(buttons).toHaveLength(withExplanation.length)
  })

  it('opens the dialog showing the clicked entry explanation', () => {
    if (!ENTRY_WITH_EXPLANATION) {
      throw new Error('No glossary entry with an explanation')
    }
    const { container } = renderView(() => <BsStatsLegend />)
    const dialog = requireDialog(container)

    requireLearnMoreButton(container, ENTRY_WITH_EXPLANATION.glossary.fullName).click()

    expect(dialog.open).toBe(true)
    expect(dialog.querySelector('h2')?.textContent).toBe(ENTRY_WITH_EXPLANATION.glossary.fullName)
    expect(dialog.querySelector('p')?.textContent).toBe(ENTRY_WITH_EXPLANATION.glossary.explanation)
  })

  it('does not reopen an already open dialog when a learn-more button is clicked', () => {
    if (!ENTRY_WITH_EXPLANATION) {
      throw new Error('No glossary entry with an explanation')
    }
    const { container } = renderView(() => <BsStatsLegend />)
    const dialog = requireDialog(container)
    const showModal = vi.fn(function markOpen(this: HTMLDialogElement) {
      this.open = true
    })
    dialog.showModal = showModal
    dialog.open = true

    requireLearnMoreButton(container, ENTRY_WITH_EXPLANATION.glossary.fullName).click()

    expect(showModal).not.toHaveBeenCalled()
  })

  it('closes the dialog when the close button is clicked', () => {
    if (!ENTRY_WITH_EXPLANATION) {
      throw new Error('No glossary entry with an explanation')
    }
    const { container } = renderView(() => <BsStatsLegend />)
    const dialog = requireDialog(container)
    requireLearnMoreButton(container, ENTRY_WITH_EXPLANATION.glossary.fullName).click()

    container.querySelector<HTMLButtonElement>('button[aria-label="Fermer"]')?.click()

    expect(dialog.open).toBe(false)
  })

  it('closes the dialog on Escape', () => {
    if (!ENTRY_WITH_EXPLANATION) {
      throw new Error('No glossary entry with an explanation')
    }
    const { container } = renderView(() => <BsStatsLegend />)
    const dialog = requireDialog(container)
    requireLearnMoreButton(container, ENTRY_WITH_EXPLANATION.glossary.fullName).click()

    dialog.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))

    expect(dialog.open).toBe(false)
  })

  it('ignores keys other than Escape', () => {
    if (!ENTRY_WITH_EXPLANATION) {
      throw new Error('No glossary entry with an explanation')
    }
    const { container } = renderView(() => <BsStatsLegend />)
    const dialog = requireDialog(container)
    requireLearnMoreButton(container, ENTRY_WITH_EXPLANATION.glossary.fullName).click()

    dialog.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))

    expect(dialog.open).toBe(true)
  })

  it('closes the dialog on a click on the backdrop but not inside the box', () => {
    if (!ENTRY_WITH_EXPLANATION) {
      throw new Error('No glossary entry with an explanation')
    }
    const { container } = renderView(() => <BsStatsLegend />)
    const dialog = requireDialog(container)
    requireLearnMoreButton(container, ENTRY_WITH_EXPLANATION.glossary.fullName).click()
    const inside = dialog.querySelector<HTMLElement>('.modal-box')
    inside?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(dialog.open).toBe(true)

    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(dialog.open).toBe(false)
  })
})
