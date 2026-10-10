import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Match from '../../libs/match/match'
import type { MatchRawData } from '../../libs/match/match.d'
import { makeMatch } from '../../libs/mock/factories/match.factory'
import { makePlayer } from '../../libs/mock/factories/player.factory'
import { resetCounters } from '../../libs/mock/mock-counter'
import { hydrateMatchs } from '../../libs/stores/matchs-store'
import { hydratePlayers } from '../../libs/stores/players-store'
import { renderView } from '../test-utils'
import { BsPlayTimeEntry } from './play-time-entry'

/**
 * Tests for the play-time entry editor. Persistence is observed by stubbing
 * only `updateMatch` from the matchs store. Toasts are stubbed at the utils
 * boundary. Every other export of both modules stays real, and every user
 * action goes through a real DOM event.
 */
const { toastMock, updateMatchMock } = vi.hoisted(() => ({
  toastMock: vi.fn<(message: string, variant?: string) => void>(),
  updateMatchMock: vi.fn<(id: string, raw: MatchRawData) => void>(),
}))

vi.mock('../../libs/utils/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../libs/utils/utils')>()
  return { ...actual, toast: toastMock }
})

vi.mock('../../libs/stores/matchs-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../libs/stores/matchs-store')>()
  return { ...actual, updateMatch: updateMatchMock }
})

const MATCH_ID = 'play-time-match-1'
const ROSTER_IDS = ['p1', 'p2', 'p3']

function buildRoster() {
  return ROSTER_IDS.map((id, index) =>
    makePlayer({ firstName: `Joueur${index + 1}`, id, jerseyNumber: String(index + 4), nicName: '' })
  )
}

function buildMatch(overrides: Partial<MatchRawData> = {}): Match {
  return new Match(makeMatch({ id: MATCH_ID, ...overrides }).getRawData())
}

function renderEntry(match: Match, onSaved = vi.fn()) {
  const roster = buildRoster()
  hydratePlayers(roster.map((player) => player.getRawData()))
  const view = renderView(() => <BsPlayTimeEntry match={match} onSaved={onSaved} roster={roster} />)
  return { ...view, onSaved }
}

function inputFor(container: HTMLElement, jerseyLabel: string): HTMLInputElement {
  const input = [...container.querySelectorAll<HTMLInputElement>('input')].find((candidate) => {
    const label = candidate.closest('label') ?? candidate.parentElement
    return label?.textContent?.includes(jerseyLabel)
  })
  if (!input) {
    throw new Error(`Input for "${jerseyLabel}" not found`)
  }
  return input
}

function typeInto(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function clickButton(container: HTMLElement, text: string) {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === text
  )
  if (!button) {
    throw new Error(`Button "${text}" not found`)
  }
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

beforeEach(() => {
  resetCounters()
  vi.clearAllMocks()
  hydrateMatchs([])
})

afterEach(() => {
  hydratePlayers([])
  hydrateMatchs([])
})

describe('BsPlayTimeEntry: initial values', () => {
  it('prefills each input with the recorded minutes of its player', () => {
    const match = buildMatch({ tablePlayTimes: { p1: 12, p2: 7 } })
    const { container } = renderEntry(match)
    expect(inputFor(container, 'Joueur1').value).toBe('12')
    expect(inputFor(container, 'Joueur2').value).toBe('7')
  })

  it('leaves the input empty for a player with no recorded minutes', () => {
    const match = buildMatch({ tablePlayTimes: { p1: 12 } })
    const { container } = renderEntry(match)
    expect(inputFor(container, 'Joueur3').value).toBe('')
  })
})

describe('BsPlayTimeEntry: saving valid minutes', () => {
  it('persists the entered minutes and calls onSaved with the new record', () => {
    const match = buildMatch()
    const { container, onSaved } = renderEntry(match)
    typeInto(inputFor(container, 'Joueur1'), '15')
    clickButton(container, 'Enregistrer les temps')
    expect(match.tablePlayTimes).toEqual({ p1: 15 })
    expect(updateMatchMock).toHaveBeenCalledWith(MATCH_ID, expect.objectContaining({ tablePlayTimes: { p1: 15 } }))
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ tablePlayTimes: { p1: 15 } }))
    expect(toastMock).toHaveBeenCalledWith('Temps de jeu enregistrés', 'success')
  })

  it('trims whitespace and skips blank inputs', () => {
    const match = buildMatch()
    const { container } = renderEntry(match)
    typeInto(inputFor(container, 'Joueur1'), '  9  ')
    typeInto(inputFor(container, 'Joueur2'), '   ')
    clickButton(container, 'Enregistrer les temps')
    expect(match.tablePlayTimes).toEqual({ p1: 9 })
  })

  it('accepts zero as a valid play time', () => {
    const match = buildMatch()
    const { container } = renderEntry(match)
    typeInto(inputFor(container, 'Joueur2'), '0')
    clickButton(container, 'Enregistrer les temps')
    expect(match.tablePlayTimes).toEqual({ p2: 0 })
  })
})

describe('BsPlayTimeEntry: rejecting invalid minutes', () => {
  it('refuses a negative value and reports the offending player', () => {
    const match = buildMatch({ tablePlayTimes: { p1: 3 } })
    const { container, onSaved } = renderEntry(match)
    typeInto(inputFor(container, 'Joueur1'), '-4')
    clickButton(container, 'Enregistrer les temps')
    expect(toastMock).toHaveBeenCalledWith('Temps invalide pour 4 Joueur1 : "-4"', 'error')
    expect(updateMatchMock).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    expect(match.tablePlayTimes).toEqual({ p1: 3 })
  })

  it('refuses a non numeric value', () => {
    const match = buildMatch()
    const { container } = renderEntry(match)
    typeInto(inputFor(container, 'Joueur2'), 'abc')
    clickButton(container, 'Enregistrer les temps')
    expect(toastMock).toHaveBeenCalledWith('Temps invalide pour 5 Joueur2 : "abc"', 'error')
    expect(updateMatchMock).not.toHaveBeenCalled()
  })
})

describe('BsPlayTimeEntry: clearing', () => {
  it('erases every recorded value and empties the inputs', () => {
    const match = buildMatch({ tablePlayTimes: { p1: 12, p2: 7 } })
    const { container, onSaved } = renderEntry(match)
    clickButton(container, 'Tout effacer')
    expect(match.tablePlayTimes).toBeUndefined()
    const persisted = updateMatchMock.mock.calls.at(-1)?.[1]
    expect(persisted).toBeDefined()
    expect(persisted).not.toHaveProperty('tablePlayTimes')
    expect(onSaved).toHaveBeenCalled()
    expect(inputFor(container, 'Joueur1').value).toBe('')
    expect(inputFor(container, 'Joueur2').value).toBe('')
    expect(toastMock).toHaveBeenCalledWith('Temps de jeu effacés', 'success')
  })
})

describe('BsPlayTimeEntry: locked match', () => {
  it('disables every input and hides the save and clear controls', () => {
    const match = buildMatch({ status: 'locked', tablePlayTimes: { p1: 12 } })
    const { container } = renderEntry(match)
    const inputs = [...container.querySelectorAll<HTMLInputElement>('input')]
    expect(inputs.length).toBeGreaterThan(0)
    expect(inputs.every((input) => input.disabled)).toBe(true)
    expect(container.textContent).toContain('Match verrouillé : temps non modifiables.')
    expect(container.querySelector('button')).toBeNull()
  })

  it('keeps the recorded minutes readable on a locked match', () => {
    const match = buildMatch({ status: 'locked', tablePlayTimes: { p1: 12 } })
    const { container } = renderEntry(match)
    expect(inputFor(container, 'Joueur1').value).toBe('12')
  })
})

describe('BsPlayTimeEntry: player labels', () => {
  it('labels a player by nickname when one is set, in the validation message', () => {
    const roster = [makePlayer({ firstName: 'Jean', id: 'p9', jerseyNumber: '7', nicName: 'Flash' })]
    hydratePlayers(roster.map((player) => player.getRawData()))
    const match = buildMatch()
    const { container } = renderView(() => <BsPlayTimeEntry match={match} onSaved={vi.fn()} roster={roster} />)
    typeInto(inputFor(container, 'Flash'), 'x')
    clickButton(container, 'Enregistrer les temps')
    expect(toastMock).toHaveBeenCalledWith('Temps invalide pour 7 Flash : "x"', 'error')
  })

  it('omits the jersey number from the label when none is set', () => {
    const roster = [makePlayer({ firstName: 'Léa', id: 'p8', jerseyNumber: '', nicName: '' })]
    hydratePlayers(roster.map((player) => player.getRawData()))
    const match = buildMatch()
    const { container } = renderView(() => <BsPlayTimeEntry match={match} onSaved={vi.fn()} roster={roster} />)
    typeInto(inputFor(container, 'Léa'), 'q')
    clickButton(container, 'Enregistrer les temps')
    expect(toastMock).toHaveBeenCalledWith('Temps invalide pour Léa : "q"', 'error')
  })
})

describe('BsPlayTimeEntry: unlocked match', () => {
  it('shows the save and clear controls without the lock notice', () => {
    const match = buildMatch({ status: 'unlocked' })
    const { container } = renderEntry(match)
    expect(container.textContent).not.toContain('Match verrouillé')
    expect(container.textContent).toContain('Enregistrer les temps')
    expect(container.textContent).toContain('Tout effacer')
  })
})
