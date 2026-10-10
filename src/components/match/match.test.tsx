import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchRawData, MatchStatLogEntry } from '../../libs/match/match.d'
import { makeMatch } from '../../libs/mock/factories/match.factory'
import { makePlayer } from '../../libs/mock/factories/player.factory'
import { makeStatEntry } from '../../libs/mock/factories/stat-entry.factory'
import { makeTeam } from '../../libs/mock/factories/team.factory'
import { resetCounters } from '../../libs/mock/mock-counter'
import { makeEmptyMatch, makePartialMatch } from '../../libs/mock/scenarios/full-game.scenario'
import { getRawMatchs, hydrateMatchs } from '../../libs/stores/matchs-store'
import { hydratePlayers } from '../../libs/stores/players-store'
import { hydrateTeams } from '../../libs/stores/teams-store'
import { renderView } from '../test-utils'
import BsMatch from './match'

/**
 * Tests for the match detail page. Persistence is mocked at the IndexedDB
 * boundary so the reactive stores stay real. Dialog confirmation and toasts
 * are mocked at the utils boundary, the vibrator is silenced, and every user
 * action goes through a real DOM event.
 */
const { confirmActionMock, toastMock, vibrateMock, goToMock, storeMatchsMock } = vi.hoisted(() => ({
  confirmActionMock: vi.fn<() => Promise<boolean>>(),
  goToMock: vi.fn<(path: string) => void>(),
  storeMatchsMock: vi.fn(() => Promise.resolve()),
  toastMock: vi.fn<(message: string, variant?: string) => void>(),
  vibrateMock: vi.fn<(theme?: string) => void>(),
}))

vi.mock('../../libs/store/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../libs/store/store')>()
  return { ...actual, storeMatchs: storeMatchsMock, storePlayers: vi.fn(() => Promise.resolve()) }
})

vi.mock('../../libs/utils/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../libs/utils/utils')>()
  return { ...actual, confirmAction: confirmActionMock, goTo: goToMock, toast: toastMock }
})

vi.mock('../../libs/vibrator/vibrator', () => ({ vibrate: vibrateMock }))

const TEAM_ID = 'team-match-1'
const MATCH_ID = 'match-page-1'
const ROSTER = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']

function seedRoster(): void {
  hydratePlayers(
    ROSTER.map((id, index) =>
      makePlayer({ firstName: `Joueur${index + 1}`, id, jerseyNumber: String(index + 4) }).getRawData()
    )
  )
  hydrateTeams([makeTeam({ id: TEAM_ID, name: 'Les Ballers', playerIds: ROSTER }).getRawData()])
}

function seedMatch(overrides: Partial<MatchRawData> = {}): void {
  hydrateMatchs([makeMatch({ id: MATCH_ID, teamId: TEAM_ID, ...overrides }).getRawData()])
}

function seedPartialMatch(): void {
  hydrateMatchs([{ ...makePartialMatch(TEAM_ID, ROSTER).getRawData(), id: MATCH_ID }])
}

function renderMatch(id = MATCH_ID) {
  return renderView(() => <BsMatch id={id} />)
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.replaceAll(/\s+/g, ' ').trim() === text
  )
  if (!button) {
    throw new Error(`Button "${text}" not found`)
  }
  return button
}

function hasButton(container: HTMLElement, text: string): boolean {
  return [...container.querySelectorAll('button')].some((candidate) => candidate.textContent?.trim() === text)
}

/** The label sits in a sibling div, so the action button is the element before that label. */
function buttonsLabelledBy(container: HTMLElement, label: string): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLDivElement>('div')]
    .filter((div) => div.textContent?.trim() === label && div.previousElementSibling?.tagName === 'BUTTON')
    .map((div) => div.previousElementSibling as HTMLButtonElement)
}

function benchButtons(container: HTMLElement): HTMLButtonElement[] {
  return buttonsLabelledBy(container, 'Rentrée')
}

function fiveOutButtons(container: HTMLElement): HTMLButtonElement[] {
  return buttonsLabelledBy(container, 'Sortie')
}

function isDisabled(button: HTMLButtonElement): boolean {
  return button.disabled
}

function lastPersistedMatch(): MatchRawData | undefined {
  return getRawMatchs().find((raw) => raw.id === MATCH_ID)
}

function lastStat(): MatchStatLogEntry {
  const stat = lastPersistedMatch()?.stats?.at(-1)
  if (!stat) {
    throw new Error('No persisted stat entry')
  }
  return stat
}

function persistedStatCount(): number {
  const persisted = lastPersistedMatch()
  if (!persisted) {
    throw new Error('Match was not persisted')
  }
  return persisted.stats?.length ?? 0
}

function click(element: HTMLElement) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

function pressKey(element: HTMLElement, code: string) {
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code }))
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  resetCounters()
  vi.clearAllMocks()
  confirmActionMock.mockResolvedValue(true)
  seedRoster()
})

afterEach(() => {
  hydrateMatchs([])
  hydratePlayers([])
  hydrateTeams([])
})

describe('BsMatch: header and empty state', () => {
  it('shows the championship badge only when the match has one', () => {
    seedMatch({ championship: 'Coupe Alpha' })
    const { container } = renderMatch()
    expect(container.querySelector('.badge')?.textContent).toBe('Coupe Alpha')
  })

  it('omits the championship badge when none is set', () => {
    seedMatch({ championship: undefined })
    const { container } = renderMatch()
    expect(container.querySelector('.badge-neutral')).toBeNull()
  })

  it('shows the empty-five prompt and an empty counter on a fresh match', () => {
    seedMatch()
    const { container } = renderMatch()
    expect(container.textContent).toContain('Veuillez sélectionner votre 5 de départ depuis le banc.')
    expect(container.querySelector('.divider')?.textContent).toContain('Le 5 (0)')
  })

  it('renders the Retour button that navigates back to the match list', () => {
    seedMatch()
    const { container } = renderMatch()
    click(buttonByText(container, 'Retour'))
    expect(goToMock).toHaveBeenCalledWith('matchs')
  })

  it('renders a missing-match fallback without crashing when the id is unknown', () => {
    const { container } = renderMatch('does-not-exist')
    expect(container.textContent).toContain('Équipe adverse')
    expect(container.textContent).toContain('Le 5 (0)')
  })
})

describe('BsMatch: starting five and bench', () => {
  it('lists the bench players with their jersey and name and hides the five', () => {
    seedMatch()
    const { container } = renderMatch()
    expect(benchButtons(container)).toHaveLength(ROSTER.length)
    expect(container.textContent).toContain('Joueur1')
  })

  it('moves a bench player onto the court when the Rentrée button is clicked', () => {
    seedMatch()
    const { container } = renderMatch()
    click(benchButtons(container)[0])
    expect(container.querySelector('.divider')?.textContent).toContain('Le 5 (1)')
    expect(fiveOutButtons(container)).toHaveLength(1)
    expect(vibrateMock).toHaveBeenCalledWith()
  })

  it('switches the counter colour to success once five players are on court', () => {
    seedMatch()
    const { container } = renderMatch()
    for (const _ of [1, 2, 3, 4, 5]) {
      click(benchButtons(container)[0])
    }
    expect(container.querySelector('.divider span')?.className).toContain('text-success')
    expect(vibrateMock).toHaveBeenLastCalledWith('long')
  })

  it('keeps the counter in error colour while fewer than five players are on court', () => {
    seedMatch()
    const { container } = renderMatch()
    click(benchButtons(container)[0])
    expect(container.querySelector('.divider span')?.className).toContain('text-error')
  })

  it('shows the empty-bench alert once every rostered player is on court', () => {
    seedMatch({ playersInTheFive: [...ROSTER] })
    const { container } = renderMatch()
    expect(container.textContent).toContain('Le banc est vide !')
    expect(benchButtons(container)).toHaveLength(0)
  })

  it('takes a court player back to the bench via the Sortie button', () => {
    seedMatch({ playersInTheFive: ['r1', 'r2'] })
    const { container } = renderMatch()
    click(fiveOutButtons(container)[0])
    expect(container.querySelector('.divider')?.textContent).toContain('Le 5 (1)')
    expect(benchButtons(container)).toHaveLength(ROSTER.length - 1)
  })

  it('persists the five changes and registers a fiveIn stat entry', () => {
    seedMatch()
    const { container } = renderMatch()
    click(benchButtons(container)[0])
    const persisted = lastPersistedMatch()
    expect(persisted?.playersInTheFive).toEqual(['r1'])
    expect(lastStat()).toMatchObject({ name: 'fiveIn', playerId: 'r1' })
    expect(storeMatchsMock).toHaveBeenCalled()
  })

  it('registers a fiveOut stat entry when a court player is taken out', () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    click(fiveOutButtons(container)[0])
    expect(lastStat()).toMatchObject({ name: 'fiveOut', playerId: 'r1' })
  })

  it('lists a court player with their scoring total and excludes them from the bench', () => {
    seedMatch({ playersInTheFive: ['r1'], stats: [makeStatEntry('2pts', { playerId: 'r1' })] })
    const { container } = renderMatch()
    const bench = benchButtons(container)
    expect(bench).toHaveLength(ROSTER.length - 1)
    expect(bench.some((button) => button.textContent?.includes('Joueur1'))).toBe(false)
    expect(container.querySelector('.divider')?.textContent).toContain('Le 5 (1)')
  })
})

describe('BsMatch: court player actions', () => {
  it('shows the Stats-mode fallback when a court player is missing from the roster', () => {
    seedMatch({ playersInTheFive: ['ghost'] })
    const { container } = renderMatch()
    expect(hasButton(container, 'Joueur non trouvé')).toBe(false)
    expect(container.querySelector('.divider')?.textContent).toContain('Le 5 (1)')
  })

  it('opens the action panel through the mobile Stats button and closes it on Retour', () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    click(buttonByText(container, 'Stats !'))
    expect(container.textContent).toContain('Action')
    click(buttonByText(container, 'Retour'))
    expect(container.textContent).not.toContain('Veuillez sélectionner')
    expect(goToMock).not.toHaveBeenCalled()
  })

  it('records a stat for the chosen player from the action panel and closes it', () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    click(buttonByText(container, 'Stats !'))
    const twoPoints = [...container.querySelectorAll<HTMLButtonElement>('.grid button')].find((button) =>
      button.textContent?.includes('2 pts')
    )
    if (!twoPoints) {
      throw new Error('2 pts action not found')
    }
    click(twoPoints)
    expect(lastStat()).toMatchObject({ name: '2pts', playerId: 'r1' })
    expect(container.textContent).toContain('Le 5 (1)')
  })
})

describe('BsMatch: opponent and game controls', () => {
  it('records an opponent point through the opponent action button', () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    const opponentPoint = container.querySelector<HTMLButtonElement>('.bg-accent .btn-success, .bg-accent button')
    if (!opponentPoint) {
      throw new Error('Opponent action not found')
    }
    click(opponentPoint)
    expect(lastStat()).toMatchObject({ playerId: 'OPPONENT' })
    expect(lastStat().playerId).not.toBe('r1')
  })

  it('records opponent-panel 2 pts under the opponent id and not a player id', () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    const opponentRow = container.querySelector<HTMLDivElement>('.bg-accent')
    const opponentPoints = opponentRow?.querySelector<HTMLButtonElement>('.btn-success')
    if (!opponentPoints) {
      throw new Error('Opponent action not found in the court view')
    }
    click(opponentPoints)
    expect(lastStat()).toMatchObject({ playerId: 'OPPONENT' })
    expect(lastStat().playerId).not.toBe('r1')
  })

  it('toggles the game between playing and stopped with a gameStop entry', () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    expect(container.textContent).toContain('Reprise du jeu')
    click(buttonByText(container, 'Reprise du jeu'))
    expect(container.textContent).toContain('Arrêt du jeu')
    expect(vibrateMock).toHaveBeenCalledWith('long')
    expect(lastStat()).toMatchObject({ name: 'gameStop' })
  })

  it('keeps the clear-last-action button disabled on an empty match', () => {
    seedMatch()
    const { container } = renderMatch()
    expect(isDisabled(buttonByText(container, 'Effacer la dernière action'))).toBe(true)
  })

  it('enables the clear-last-action button once a stat exists', () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    click(benchButtons(container)[0])
    expect(isDisabled(buttonByText(container, 'Effacer la dernière action'))).toBe(false)
  })

  it('removes the last stat after confirmation when the clear button is clicked', async () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    click(benchButtons(container)[0])
    click(buttonByText(container, 'Effacer la dernière action'))
    await flush()
    expect(confirmActionMock).toHaveBeenCalled()
    expect(lastPersistedMatch()?.stats).toEqual([])
  })

  it('keeps the stat when the clear confirmation is declined', async () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    click(benchButtons(container)[0])
    confirmActionMock.mockResolvedValueOnce(false)
    click(buttonByText(container, 'Effacer la dernière action'))
    await flush()
    expect(persistedStatCount()).toBe(1)
  })

  it('clears the last action with the Enter key', async () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    click(benchButtons(container)[0])
    pressKey(buttonByText(container, 'Effacer la dernière action'), 'Enter')
    await flush()
    expect(lastPersistedMatch()?.stats).toEqual([])
  })

  it('ignores non-Enter keys on the clear button', async () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    click(benchButtons(container)[0])
    pressKey(buttonByText(container, 'Effacer la dernière action'), 'KeyA')
    await flush()
    expect(persistedStatCount()).toBe(1)
  })

  it('refuses to clear actions on a locked match and opens the stat grid', () => {
    seedMatch({ playersInTheFive: ['r1'], stats: [makeStatEntry('2pts', { playerId: 'r1' })], status: 'locked' })
    const { container } = renderMatch()
    expect(container.textContent).toContain('Totaux de l’équipe:')
    expect(container.textContent).not.toContain('Effacer la dernière action')
    expect(toastMock).not.toHaveBeenCalled()
  })
})

describe('BsMatch: stat grid mode', () => {
  it('opens the stat grid from the Tableau des stats button', () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    click(buttonByText(container, 'Tableau des stats'))
    expect(container.textContent).toContain('Totaux de l’équipe:')
    expect(container.textContent).toContain('Synthèse rebonds')
    expect(container.querySelector('.divider')).toBeNull()
  })

  it('opens the stat grid from the Enter key on the Tableau des stats button', () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    pressKey(buttonByText(container, 'Tableau des stats'), 'Enter')
    expect(container.textContent).toContain('Totaux de l’équipe:')
  })

  it('ignores non-Enter keys on the Tableau des stats button', () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    pressKey(buttonByText(container, 'Tableau des stats'), 'KeyA')
    expect(container.textContent).not.toContain('Totaux de l’équipe:')
  })

  it('opens the stat grid straight away on a locked match', () => {
    seedMatch({ stats: [makeStatEntry('2pts', { playerId: 'r1' })], status: 'locked' })
    const { container } = renderMatch()
    expect(container.textContent).toContain('Totaux de l’équipe:')
    expect(container.textContent).not.toContain('Le banc est vide')
  })

  it('returns to the live view from the stat grid Retour button', () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    click(buttonByText(container, 'Tableau des stats'))
    click(buttonByText(container, 'Retour'))
    expect(container.textContent).toContain('Effacer la dernière action')
    expect(goToMock).not.toHaveBeenCalled()
  })

  it('renders team totals with the score colour set by the result', () => {
    seedMatch({ playersInTheFive: ['r1'], stats: [makeStatEntry('3pts', { playerId: 'r1' })] })
    const { container } = renderMatch()
    click(buttonByText(container, 'Tableau des stats'))
    expect(container.querySelector('.stat-value.text-success')).not.toBeNull()
  })

  it('renders the full game without throwing and shows the play-time panel', () => {
    seedPartialMatch()
    const { container } = renderMatch()
    click(buttonByText(container, 'Tableau des stats'))
    expect(container.textContent).toContain('Totaux de l’équipe:')
    expect(container.querySelector('.print\\:break-inside-avoid')).not.toBeNull()
  })

  it('exposes the play-time entry editor only when a match is loaded', () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    click(buttonByText(container, 'Tableau des stats'))
    expect(container.textContent).toContain('Temps de jeu (feuille de match)')
  })

  it('hides the play-time editor on the unknown-match fallback', () => {
    const { container } = renderMatch('does-not-exist')
    click(buttonByText(container, 'Tableau des stats'))
    expect(container.textContent).not.toContain('Temps de jeu (feuille de match)')
  })

  it('keeps the stats grid rendering after the play-time editor is shown', () => {
    seedMatch({ playersInTheFive: ['r1'] })
    const { container } = renderMatch()
    click(buttonByText(container, 'Tableau des stats'))
    expect(container.textContent).toContain('Temps de jeu (feuille de match)')
    expect(container.textContent).toContain('Totaux de l’équipe:')
    expect(lastPersistedMatch()?.id).toBe(MATCH_ID)
  })
})

describe('BsMatch: empty and partial match stats', () => {
  it('renders an empty match in stat mode with zeroed totals', () => {
    hydrateMatchs([{ ...makeEmptyMatch(TEAM_ID).getRawData(), id: MATCH_ID }])
    const { container } = renderMatch()
    click(buttonByText(container, 'Retour'))
    expect(container.textContent).toContain('Le 5 (0)')
  })

  it('shows the bench with a partial match whose starters are on court', () => {
    seedPartialMatch()
    const { container } = renderMatch()
    expect(container.querySelector('.divider')?.textContent).toContain('Le 5 (5)')
    expect(benchButtons(container)).toHaveLength(ROSTER.length - 5)
  })
})
