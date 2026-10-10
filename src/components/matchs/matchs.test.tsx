import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchRawData } from '../../libs/match/match.d'
import { makeMatch } from '../../libs/mock/factories/match.factory'
import { makeStatEntry } from '../../libs/mock/factories/stat-entry.factory'
import { makeTeam } from '../../libs/mock/factories/team.factory'
import { resetCounters } from '../../libs/mock/mock-counter'
import { getRawMatchs, hydrateMatchs } from '../../libs/stores/matchs-store'
import { hydrateTeams } from '../../libs/stores/teams-store'
import type { MatchFormatConfig } from '../../libs/team/match-format'
import { renderView } from '../test-utils'
import BsMatchs from './matchs'

/**
 * Tests for the match list page. The component keeps its add/edit form state
 * in module-level singletons, so every test resets both collection stores and
 * closes any open form. Persistence is mocked on the store module so no write
 * reaches IndexedDB, while the reactive store stays real.
 */
vi.mock('../../libs/store/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../libs/store/store')>()
  return {
    ...actual,
    storeMatchs: vi.fn(() => Promise.resolve()),
    storeTeams: vi.fn(() => Promise.resolve()),
  }
})

const TEAM_ID = 'team-list-1'
const TEAM_NAME = 'Les Ballers'
const CHAMP_A = 'Coupe Alpha'
const CHAMP_B = 'Ligue Beta'
const PLAYED_FORMAT: MatchFormatConfig = { periodLengthMinutes: 10, periods: 4, playersOnCourt: 5 }
const TEAM_FORMAT: MatchFormatConfig = { periodLengthMinutes: 6, periods: 3, playersOnCourt: 4 }

function seedTeam(matchFormat?: MatchFormatConfig) {
  const team = makeTeam({ id: TEAM_ID, matchFormat, name: TEAM_NAME, playerIds: ['p0', 'p1'] })
  hydrateTeams([team.getRawData()])
}

function winMatch(overrides: Partial<MatchRawData> = {}): MatchRawData {
  return makeMatch({
    date: '2026-03-14T18:30:00.000Z',
    opponent: 'Victoire FC',
    stats: [makeStatEntry('3pts', { playerId: 'p0' }), makeStatEntry('2pts', { playerId: 'OPPONENT' })],
    teamId: TEAM_ID,
    ...overrides,
  }).getRawData()
}

function lossMatch(overrides: Partial<MatchRawData> = {}): MatchRawData {
  return makeMatch({
    date: '2026-02-01T18:30:00.000Z',
    opponent: 'Defaite SC',
    stats: [makeStatEntry('2pts', { playerId: 'p0' }), makeStatEntry('3pts', { playerId: 'OPPONENT' })],
    teamId: TEAM_ID,
    ...overrides,
  }).getRawData()
}

function getButtonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === text
  )
  if (!button) {
    throw new Error(`Button "${text}" not found`)
  }
  return button
}

function findSectionNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('section > div.divider')].map((divider) => divider.textContent ?? '')
}

/** Save button label is "Ajouter" for a new match and "Enregistrer" when editing. */
function getSaveButton(container: HTMLElement): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    ['Ajouter', 'Enregistrer'].includes(candidate.textContent?.trim() ?? '')
  )
  if (!button) {
    throw new Error('Save button not found')
  }
  return button
}

function findTileTitles(container: HTMLElement): string[] {
  return [...container.querySelectorAll('section div.card h2')].map((title) => title.textContent ?? '')
}

function findTileCard(container: HTMLElement, opponent: string): HTMLElement {
  const card = [...container.querySelectorAll<HTMLElement>('div.card')].find(
    (candidate) => candidate.querySelector('h2')?.textContent === opponent
  )
  if (!card) {
    throw new Error(`Tile "${opponent}" not found`)
  }
  return card
}

function findEditButtonFor(container: HTMLElement, opponent: string): HTMLButtonElement {
  const button = findTileCard(container, opponent).querySelector<HTMLButtonElement>(
    'button[aria-label="Modifier le match"]'
  )
  if (!button) {
    throw new Error(`Edit button for "${opponent}" not found`)
  }
  return button
}

/** Finds the form control that sits next to a field label in the add/edit card. */
function getFieldControl<T extends HTMLElement>(container: HTMLElement, labelText: string): T {
  const label = [...container.querySelectorAll<HTMLElement>('div.label')].find(
    (candidate) => candidate.textContent?.trim() === labelText
  )
  const control = label?.parentElement?.querySelector<T>('select, input')
  if (!control) {
    throw new Error(`Control for label "${labelText}" not found`)
  }
  return control
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Dispatches the input and change events a user typing produces, in that order. */
function typeIntoInput(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function pressKey(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
}

function openAddForm(container: HTMLElement) {
  getButtonByText(container, 'Ajouter un match').click()
}

function fillRequiredFields(container: HTMLElement, opponent: string) {
  setSelectValue(getFieldControl<HTMLSelectElement>(container, 'Mon Équipe'), TEAM_ID)
  setSelectValue(getFieldControl<HTMLSelectElement>(container, 'Localité'), 'home')
  typeIntoInput(getFieldControl<HTMLInputElement>(container, 'Nom de l’adversaire'), opponent)
}

/**
 * The add/edit form state is a module singleton that survives unmounting. A test
 * that ends with the form open would leak it into the next test, so this mounts
 * the page, closes the form through its real Annuler button, and disposes it.
 */
function closeLeakedAddForm() {
  const { container, dispose } = renderView(() => <BsMatchs />)
  const cancel = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === 'Annuler'
  )
  cancel?.click()
  dispose()
}

beforeEach(() => {
  vi.clearAllMocks()
  resetCounters()
  window.location.hash = ''
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  hydrateMatchs([])
  hydrateTeams([])
  closeLeakedAddForm()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BsMatchs match list page', () => {
  describe('empty state', () => {
    it('shows the empty message and no championship section when there is no match', () => {
      const { container } = renderView(() => <BsMatchs />)

      expect(container.textContent).toContain('Aucun match enregistrée.')
      expect(container.querySelectorAll('section')).toHaveLength(0)
    })

    it('still offers the add button when the list is empty', () => {
      const { container } = renderView(() => <BsMatchs />)

      expect(getButtonByText(container, 'Ajouter un match')).toBeTruthy()
    })
  })

  describe('grouping and ordering', () => {
    it('renders one section per championship with the championship name as divider', () => {
      seedTeam()
      hydrateMatchs([
        winMatch({ championship: CHAMP_B, id: 'b1', opponent: 'Beta One' }),
        winMatch({ championship: CHAMP_A, id: 'a1', opponent: 'Alpha One' }),
      ])

      const { container } = renderView(() => <BsMatchs />)

      expect(findSectionNames(container)).toEqual([CHAMP_A, CHAMP_B])
    })

    it('renders matches without championship in a last section labelled "Sans championnat"', () => {
      seedTeam()
      hydrateMatchs([
        winMatch({ championship: null, id: 'n1', opponent: 'Orphan FC' }),
        winMatch({ championship: CHAMP_A, id: 'a1', opponent: 'Alpha One' }),
        winMatch({ championship: '', id: 'n2', opponent: 'Empty Champ FC' }),
      ])

      const { container } = renderView(() => <BsMatchs />)

      expect(findSectionNames(container)).toEqual([CHAMP_A, 'Sans championnat'])
      const sections = container.querySelectorAll('section')
      expect(sections[1]?.textContent).toContain('Orphan FC')
      expect(sections[1]?.textContent).toContain('Empty Champ FC')
    })

    it('orders matches chronologically (oldest first) inside each championship', () => {
      seedTeam()
      hydrateMatchs([
        winMatch({ championship: CHAMP_A, date: '2026-05-10T10:00:00.000Z', id: 'late', opponent: 'Late Opp' }),
        winMatch({ championship: CHAMP_A, date: '2026-01-05T10:00:00.000Z', id: 'early', opponent: 'Early Opp' }),
        winMatch({ championship: CHAMP_A, date: '2026-03-01T10:00:00.000Z', id: 'mid', opponent: 'Mid Opp' }),
      ])

      const { container } = renderView(() => <BsMatchs />)

      expect(findTileTitles(container)).toEqual(['Early Opp', 'Mid Opp', 'Late Opp'])
    })

    it('keeps the championship groups alphabetical regardless of insertion order', () => {
      seedTeam()
      hydrateMatchs([
        winMatch({ championship: 'Zeta Cup', id: 'z', opponent: 'Z Opp' }),
        winMatch({ championship: 'Alpha Cup', id: 'a', opponent: 'A Opp' }),
        winMatch({ championship: 'Mu Cup', id: 'm', opponent: 'M Opp' }),
      ])

      const { container } = renderView(() => <BsMatchs />)

      expect(findSectionNames(container)).toEqual(['Alpha Cup', 'Mu Cup', 'Zeta Cup'])
    })
  })

  describe('score and outcome display', () => {
    it('shows a victory badge on a winning tile and a defeat badge on a losing tile', () => {
      seedTeam()
      hydrateMatchs([
        winMatch({ championship: CHAMP_A, id: 'w', opponent: 'Victoire FC' }),
        lossMatch({ championship: CHAMP_A, id: 'l', opponent: 'Defaite SC' }),
      ])

      const { container } = renderView(() => <BsMatchs />)

      expect(findTileCard(container, 'Victoire FC').textContent).toContain('Victoire')
      expect(findTileCard(container, 'Defaite SC').textContent).toContain('Défaite')
    })

    it('shows the team name and no outcome badge for a match without stats', () => {
      seedTeam()
      hydrateMatchs([
        makeMatch({ championship: CHAMP_A, id: 'fresh', opponent: 'Fresh FC', teamId: TEAM_ID }).getRawData(),
      ])

      const { container } = renderView(() => <BsMatchs />)

      const card = findTileCard(container, 'Fresh FC')
      expect(card.textContent).toContain(`${TEAM_NAME} (2)`)
      expect(card.textContent).not.toContain('Victoire')
      expect(card.textContent).not.toContain('Défaite')
    })
  })

  describe('navigation', () => {
    it('opens the detail page of the clicked match', () => {
      seedTeam()
      hydrateMatchs([
        winMatch({ championship: CHAMP_A, id: 'match-42', opponent: 'Target FC' }),
        lossMatch({ championship: CHAMP_A, id: 'match-7', opponent: 'Other SC' }),
      ])

      const { container } = renderView(() => <BsMatchs />)
      findTileCard(container, 'Target FC').click()

      expect(window.location.hash).toBe('#/match/match-42')
    })

    it('does not navigate when the edit button is clicked, and opens the edit form instead', () => {
      seedTeam()
      hydrateMatchs([winMatch({ championship: CHAMP_A, id: 'match-42', opponent: 'Target FC' })])

      const { container } = renderView(() => <BsMatchs />)
      findEditButtonFor(container, 'Target FC').click()

      expect(window.location.hash).toBe('')
      expect(container.textContent).toContain('Édition du match')
    })
  })

  describe('add form', () => {
    it('replaces the list with the add card and returns to the list on cancel', () => {
      seedTeam()
      hydrateMatchs([winMatch({ championship: CHAMP_A, id: 'm1', opponent: 'Listed FC' })])

      const { container } = renderView(() => <BsMatchs />)
      openAddForm(container)

      expect(container.textContent).toContain('Nouveau match')
      expect(findTileTitles(container)).toEqual([])

      getButtonByText(container, 'Annuler').click()

      expect(container.textContent).toContain('Listed FC')
      expect(container.textContent).not.toContain('Nouveau match')
    })

    it('keeps the save button disabled until the form is registerable', () => {
      seedTeam()
      const { container } = renderView(() => <BsMatchs />)
      openAddForm(container)

      expect(getSaveButton(container).disabled).toBe(true)
    })

    it('stores the date entered in the date picker on the new match', () => {
      seedTeam()
      const { container } = renderView(() => <BsMatchs />)
      openAddForm(container)
      fillRequiredFields(container, 'Dated Rival')

      typeIntoInput(
        container.querySelector<HTMLInputElement>('input[type="datetime-local"]') as HTMLInputElement,
        '2026-06-20T19:00'
      )
      getSaveButton(container).click()

      expect(getRawMatchs()[0]?.date).toContain('2026-06-20')
    })

    it('registers a new match with the team, opponent, locality and championship entered in the form', () => {
      seedTeam()
      const { container } = renderView(() => <BsMatchs />)
      openAddForm(container)

      fillRequiredFields(container, 'New Rival')
      setSelectValue(getFieldControl<HTMLSelectElement>(container, 'Localité'), 'outside')
      typeIntoInput(getFieldControl<HTMLInputElement>(container, 'Championnat'), CHAMP_B)

      const saveButton = getSaveButton(container)
      expect(saveButton.disabled).toBe(false)
      saveButton.click()

      const saved = getRawMatchs()
      expect(saved).toHaveLength(1)
      expect(saved[0]).toMatchObject({ championship: CHAMP_B, opponent: 'New Rival', teamId: TEAM_ID, type: 'outside' })
      expect(container.textContent).not.toContain('Nouveau match')
    })

    it('gives a new match the default format of the selected team', () => {
      seedTeam(TEAM_FORMAT)
      const { container } = renderView(() => <BsMatchs />)
      openAddForm(container)

      fillRequiredFields(container, 'Format Rival')
      getSaveButton(container).click()

      expect(getRawMatchs()[0]?.matchFormat).toEqual(TEAM_FORMAT)
    })

    it('does not register a match from the Enter key when the form is incomplete', () => {
      seedTeam()
      const { container } = renderView(() => <BsMatchs />)
      openAddForm(container)

      pressKey(container.querySelector<HTMLFormElement>('form') as HTMLFormElement, 'Enter')

      expect(getRawMatchs()).toHaveLength(0)
    })

    it('ignores keys other than Enter on the form', () => {
      seedTeam()
      const { container } = renderView(() => <BsMatchs />)
      openAddForm(container)
      fillRequiredFields(container, 'Keys Rival')

      pressKey(container.querySelector<HTMLFormElement>('form') as HTMLFormElement, 'a')

      expect(getRawMatchs()).toHaveLength(0)
      expect(container.textContent).toContain('Nouveau match')
    })

    it('registers a complete match on Enter key submission', () => {
      seedTeam()
      const { container } = renderView(() => <BsMatchs />)
      openAddForm(container)
      fillRequiredFields(container, 'Enter Rival')

      pressKey(container.querySelector<HTMLFormElement>('form') as HTMLFormElement, 'Enter')

      expect(getRawMatchs()).toHaveLength(1)
      expect(getRawMatchs()[0]?.opponent).toBe('Enter Rival')
    })

    it('stores a new match as unlocked by default, since the open toggle starts on', () => {
      seedTeam()
      const { container } = renderView(() => <BsMatchs />)
      openAddForm(container)
      fillRequiredFields(container, 'Open Rival')

      getSaveButton(container).click()

      expect(getRawMatchs()[0]?.status).toBe('unlocked')
    })

    it('stores the status as locked when the open toggle is switched off', () => {
      seedTeam()
      const { container } = renderView(() => <BsMatchs />)
      openAddForm(container)
      fillRequiredFields(container, 'Locked Rival')

      const toggle = container.querySelector<HTMLInputElement>('input[type="checkbox"]') as HTMLInputElement
      toggle.click()
      toggle.click()
      getSaveButton(container).click()

      expect(getRawMatchs()[0]?.status).toBe('locked')
    })

    it('offers the existing championships as options of the championship combobox', () => {
      seedTeam()
      hydrateMatchs([
        winMatch({ championship: CHAMP_B, id: 'b1', opponent: 'Beta One' }),
        winMatch({ championship: CHAMP_A, id: 'a1', opponent: 'Alpha One' }),
      ])
      const { container } = renderView(() => <BsMatchs />)
      openAddForm(container)

      getFieldControl<HTMLInputElement>(container, 'Championnat').focus()

      const options = [...container.querySelectorAll('[role="option"]')].map((option) => option.textContent?.trim())
      expect(options).toEqual([CHAMP_A, CHAMP_B])
    })
  })

  describe('edit form', () => {
    it('loads the selected match into the edit form with its values', () => {
      seedTeam()
      hydrateMatchs([winMatch({ championship: CHAMP_A, id: 'edit-me', opponent: 'Editable FC' })])
      const { container } = renderView(() => <BsMatchs />)

      findEditButtonFor(container, 'Editable FC').click()

      expect(container.textContent).toContain('Édition du match')
      expect(getFieldControl<HTMLInputElement>(container, 'Nom de l’adversaire').value).toBe('Editable FC')
      expect(getSaveButton(container).disabled).toBe(false)
    })

    it('saves edits to the stored match in place without creating a new one', () => {
      seedTeam()
      hydrateMatchs([winMatch({ championship: CHAMP_A, id: 'edit-me', opponent: 'Editable FC' })])
      const { container } = renderView(() => <BsMatchs />)
      findEditButtonFor(container, 'Editable FC').click()

      typeIntoInput(getFieldControl<HTMLInputElement>(container, 'Nom de l’adversaire'), 'Renamed FC')
      getSaveButton(container).click()

      const saved = getRawMatchs()
      expect(saved).toHaveLength(1)
      expect(saved[0]).toMatchObject({ id: 'edit-me', opponent: 'Renamed FC' })
    })

    it('keeps the recorded format of an edited match when its team changes', () => {
      seedTeam(TEAM_FORMAT)
      hydrateMatchs([
        winMatch({ championship: CHAMP_A, id: 'played', matchFormat: PLAYED_FORMAT, opponent: 'Played FC' }),
      ])
      const { container } = renderView(() => <BsMatchs />)
      findEditButtonFor(container, 'Played FC').click()

      setSelectValue(getFieldControl<HTMLSelectElement>(container, 'Mon Équipe'), TEAM_ID)
      getSaveButton(container).click()

      expect(getRawMatchs()[0]?.matchFormat).toEqual(PLAYED_FORMAT)
    })

    it('discards an edit when cancelled and leaves the stored match untouched', () => {
      seedTeam()
      hydrateMatchs([winMatch({ championship: CHAMP_A, id: 'keep-me', opponent: 'Keep FC' })])
      const { container } = renderView(() => <BsMatchs />)
      findEditButtonFor(container, 'Keep FC').click()

      typeIntoInput(getFieldControl<HTMLInputElement>(container, 'Nom de l’adversaire'), 'Discarded FC')
      getButtonByText(container, 'Annuler').click()

      expect(getRawMatchs()[0]?.opponent).toBe('Keep FC')
      expect(container.textContent).toContain('Keep FC')
    })
  })

  describe('reactive store updates', () => {
    it('re-renders the list when a match is added to the store', () => {
      seedTeam()
      const { container } = renderView(() => <BsMatchs />)
      expect(container.textContent).toContain('Aucun match enregistrée.')

      hydrateMatchs([winMatch({ championship: CHAMP_A, id: 'late-add', opponent: 'Live Added FC' })])

      expect(container.textContent).toContain('Live Added FC')
      expect(container.textContent).not.toContain('Aucun match enregistrée.')
    })
  })
})
