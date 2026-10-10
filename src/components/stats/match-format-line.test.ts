import { createComponent } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Match from '../../libs/match/match'
import type { MatchRawData } from '../../libs/match/match.d'
import type { ResolvedMatchFormat } from '../../libs/team/match-format'
import { renderView } from '../test-utils'
import { BsMatchFormatLine, formatSourceLabel } from './match-format-line'

const { updateMatchMock, toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn<(message: string, variant?: string) => void>(),
  updateMatchMock: vi.fn<(id: string, raw: MatchRawData) => void>(),
}))

vi.mock('../../libs/stores/matchs-store', () => ({
  updateMatch: updateMatchMock,
}))

vi.mock('../../libs/utils/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../libs/utils/utils')>()
  return { ...actual, toast: toastMock }
})

const resolved = (
  source: ResolvedMatchFormat['source'],
  config = { periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 }
): ResolvedMatchFormat => ({ ...config, source })

describe('formatSourceLabel', () => {
  it('labels a match-owned format', () => {
    expect(formatSourceLabel(resolved('match-override'))).toBe('Réglage du match')
  })

  it('labels the team default', () => {
    expect(formatSourceLabel(resolved('team-default'))).toBe('Format par défaut de l’équipe')
  })

  it('names the category on a category preset', () => {
    expect(formatSourceLabel(resolved('category-preset'), 'U13')).toBe('Préréglage de la catégorie U13')
  })

  it('stays generic on a category preset without a category', () => {
    expect(formatSourceLabel(resolved('category-preset'))).toBe('Préréglage de la catégorie d’âge')
    expect(formatSourceLabel(resolved('category-preset'), null)).toBe('Préréglage de la catégorie d’âge')
  })

  it('labels the bare fallback', () => {
    expect(formatSourceLabel(resolved('default'))).toBe('Format par défaut')
  })
})

interface MountOptions {
  category?: 'U13' | null
  format?: ResolvedMatchFormat
  matchData?: MatchRawData
}

function mountLine(options: MountOptions = {}) {
  const match = new Match({ id: 'm1', status: 'unlocked', teamId: 't1', ...options.matchData })
  const onSaved = vi.fn<(raw: MatchRawData) => void>()
  const format = options.format ?? resolved('default')
  renderView(() =>
    createComponent(BsMatchFormatLine, {
      category: options.category,
      format,
      match,
      onSaved,
    })
  )
  return { match, onSaved }
}

function buttonByText(text: string): HTMLButtonElement {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(text)
  )
  if (!button) {
    throw new Error(`No button containing "${text}"`)
  }
  return button
}

function fieldInput(label: string): HTMLInputElement {
  const labelEl = [...document.querySelectorAll('label')].find((candidate) => candidate.textContent?.includes(label))
  const input = labelEl?.querySelector<HTMLInputElement>('input')
  if (!input) {
    throw new Error(`No input for "${label}"`)
  }
  return input
}

function typeIntoField(label: string, value: string): void {
  const input = fieldInput(label)
  input.value = value
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function clickButton(text: string): void {
  buttonByText(text).dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function editorOpen(): boolean {
  return document.body.textContent?.includes('Joueurs sur le terrain') ?? false
}

describe('BsMatchFormatLine rendering', () => {
  beforeEach(() => {
    updateMatchMock.mockClear()
    toastMock.mockClear()
  })

  it('shows the formatted format, the theoretical total and the provenance badge', () => {
    mountLine({ format: resolved('team-default', { periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 }) })
    expect(document.body.textContent).toContain('4 périodes × 8 min × 5 joueurs')
    expect(document.body.textContent).toContain('160 min de jeu théoriques')
    expect(document.body.textContent).toContain('Format par défaut de l’équipe')
  })

  it('names the category in the badge for a category preset', () => {
    mountLine({ category: 'U13', format: resolved('category-preset') })
    expect(document.body.textContent).toContain('Préréglage de la catégorie U13')
  })

  it('shows the lock icon and hides the edit button on a locked match', () => {
    mountLine({ matchData: { status: 'locked' } })
    expect(document.querySelector('h3 svg')).not.toBeNull()
    expect([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Modifier'))).toBe(false)
  })

  it('shows the edit button and no lock icon on an unlocked match', () => {
    mountLine()
    expect(document.querySelector('h3 svg')).toBeNull()
    expect(buttonByText('Modifier')).toBeInstanceOf(HTMLButtonElement)
  })

  it('keeps the editor closed until the edit button is clicked', () => {
    mountLine()
    expect(editorOpen()).toBe(false)
  })
})

describe('BsMatchFormatLine editing', () => {
  beforeEach(() => {
    updateMatchMock.mockClear()
    toastMock.mockClear()
  })

  it('opens the editor seeded with the resolved numbers', () => {
    mountLine({ format: resolved('default', { periodLengthMinutes: 10, periods: 4, playersOnCourt: 5 }) })
    clickButton('Modifier')
    expect(editorOpen()).toBe(true)
    expect(fieldInput('Périodes').value).toBe('4')
    expect(fieldInput('Durée d’une période').value).toBe('10')
    expect(fieldInput('Joueurs sur le terrain').value).toBe('5')
  })

  it('shows the fallback button for an unowned match whose format is not the override', () => {
    mountLine({ format: resolved('team-default') })
    clickButton('Modifier')
    expect(buttonByText('Appliquer le format par défaut')).toBeInstanceOf(HTMLButtonElement)
  })

  it('hides the fallback button when the match already owns its format', () => {
    mountLine({
      format: resolved('match-override'),
      matchData: { matchFormat: { periodLengthMinutes: 8, periods: 2, playersOnCourt: 5 } },
    })
    clickButton('Modifier')
    expect(editorOpen()).toBe(true)
    expect([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Appliquer'))).toBe(false)
  })

  it('persists a valid edit, notifies the parent, toasts success and closes the editor', () => {
    const { match, onSaved } = mountLine()
    clickButton('Modifier')
    typeIntoField('Périodes', '2')
    typeIntoField('Durée d’une période', '12')
    typeIntoField('Joueurs sur le terrain', '3')
    clickButton('Enregistrer le format')

    expect(updateMatchMock).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ matchFormat: { periodLengthMinutes: 12, periods: 2, playersOnCourt: 3 } })
    )
    expect(match.matchFormat).toEqual({ periodLengthMinutes: 12, periods: 2, playersOnCourt: 3 })
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(toastMock).toHaveBeenCalledWith('Format du match enregistré', 'success')
    expect(editorOpen()).toBe(false)
  })

  it('rejects an invalid edit with an error toast and keeps the editor open', () => {
    const { onSaved } = mountLine()
    clickButton('Modifier')
    typeIntoField('Périodes', '0')
    clickButton('Enregistrer le format')

    expect(updateMatchMock).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith('Format invalide : saisir trois entiers positifs.', 'error')
    expect(editorOpen()).toBe(true)
  })

  it('rejects a non-integer value', () => {
    mountLine()
    clickButton('Modifier')
    typeIntoField('Durée d’une période', '8.5')
    clickButton('Enregistrer le format')
    expect(updateMatchMock).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith(expect.stringContaining('Format invalide'), 'error')
  })

  it('applies the fallback as a match-owned format with the source stripped', () => {
    const { match, onSaved } = mountLine({
      format: resolved('team-default', { periodLengthMinutes: 10, periods: 4, playersOnCourt: 5 }),
    })
    clickButton('Modifier')
    clickButton('Appliquer le format par défaut')

    expect(match.matchFormat).toEqual({ periodLengthMinutes: 10, periods: 4, playersOnCourt: 5 })
    expect(match.matchFormat).not.toHaveProperty('source')
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(toastMock).toHaveBeenCalledWith('Format par défaut appliqué au match', 'success')
    expect(editorOpen()).toBe(false)
  })
})
