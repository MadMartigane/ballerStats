import { useLocation } from '@solidjs/router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makePlayer } from '../../libs/mock/factories/player.factory'
import { makeTeam } from '../../libs/mock/factories/team.factory'
import { resetCounters } from '../../libs/mock/mock-counter'
import { storeTeams } from '../../libs/store/store'
import { hydratePlayers } from '../../libs/stores/players-store'
import { getRawTeams, getTeamById, hydrateTeams } from '../../libs/stores/teams-store'
import { renderInRouter } from '../test-utils'
import BsTeams from './teams'

// Persistence goes through the store mutations; the storage layer is replaced so no IndexedDB writes happen.
vi.mock('../../libs/store/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../libs/store/store')>()
  return {
    ...actual,
    storeTeams: vi.fn(() => Promise.resolve()),
  }
})

const NAME_PLACEHOLDER = 'BCC U09'
const PERIODS_PLACEHOLDER = '4'
const PERIOD_LENGTH_PLACEHOLDER = '8'
const PLAYERS_ON_COURT_PLACEHOLDER = '5'
const EMPTY_STATE_TEXT = 'Aucune équipe enregistrée.'
const FORMAT_HINT_TEXT = 'Format par défaut invalide'
const PREVIEW_PREFIX = 'Format par défaut :'

function setupDialogStubs() {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
  }
}

function teardownDialogStubs() {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
}

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.trim() === text
  )
  if (!button) {
    throw new Error(`Button "${text}" not found`)
  }
  return button
}

function findButtonByAriaLabel(root: ParentNode, label: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!button) {
    throw new Error(`Button aria-label "${label}" not found`)
  }
  return button
}

function findInputByPlaceholder(root: ParentNode, placeholder: string): HTMLInputElement {
  const input = root.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)
  if (!input) {
    throw new Error(`Input placeholder "${placeholder}" not found`)
  }
  return input
}

function findSelect(root: ParentNode): HTMLSelectElement {
  const select = root.querySelector<HTMLSelectElement>('select')
  if (!select) {
    throw new Error('Category select not found')
  }
  return select
}

function clickElement(element: HTMLElement) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }))
}

/** Simulates the user committing a text input (native `change` event). */
function commitInput(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function chooseOption(select: HTMLSelectElement, value: string) {
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

function pressEnterOn(element: HTMLElement) {
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
}

async function flushMacrotasks() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

function renderTeamsPage(path = '/teams') {
  return renderInRouter(
    () => {
      const location = useLocation()
      return (
        <>
          <BsTeams />
          <output data-testid="location">{location.pathname}</output>
        </>
      )
    },
    { path }
  )
}

/**
 * The page keeps its draft form in module-level state that survives unmounting.
 * Cancelling an open form returns that state to its initial values.
 */
function resetPageDraftState() {
  const probe = renderTeamsPage()
  const cancelButton = Array.from(probe.container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === 'Annuler'
  )
  if (cancelButton) {
    clickElement(cancelButton)
  }
  probe.dispose()
}

function openNewTeamForm(container: HTMLElement) {
  clickElement(findButtonByText(container, 'Ajouter une équipe'))
}

/** Tile titles only: the tile heading carries a `title` attribute, the form card heading does not. */
function getListedTeamTitles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('h2[title]')).map((heading) => heading.textContent ?? '')
}

function getPreviewText(container: HTMLElement): string {
  const preview = Array.from(container.querySelectorAll('p')).find((paragraph) =>
    paragraph.textContent?.startsWith(PREVIEW_PREFIX)
  )
  if (!preview) {
    throw new Error('Format preview not found')
  }
  return preview.textContent ?? ''
}

/** The primary form action: `Ajouter` for a new team, `Enregistrer` while editing one. */
function getSaveButton(container: HTMLElement): HTMLButtonElement {
  const isEditing = container.textContent?.includes('Édition de l’équipe') ?? false
  return findButtonByText(container, isEditing ? 'Enregistrer' : 'Ajouter')
}

/** The confirm dialog built by `confirmAction`: the success button confirms, the warning button cancels. */
function getConfirmButton(): HTMLButtonElement {
  return getDialogButton('btn-success')
}

function getCancelDialogButton(): HTMLButtonElement {
  return getDialogButton('btn-warning')
}

function getDialogButton(variantClass: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`dialog button.${variantClass}`)
  if (!button) {
    throw new Error(`Dialog button ${variantClass} not found`)
  }
  return button
}

describe('BsTeams', () => {
  beforeEach(() => {
    resetCounters()
    setupDialogStubs()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    vi.mocked(storeTeams).mockClear()
    hydrateTeams([])
    hydratePlayers([])
    resetPageDraftState()
  })

  afterEach(() => {
    for (const dialog of document.querySelectorAll('dialog')) {
      dialog.remove()
    }
    teardownDialogStubs()
    hydrateTeams([])
    hydratePlayers([])
    vi.restoreAllMocks()
  })

  describe('list', () => {
    it('shows the empty-state message and the add button when no team is stored', () => {
      const { container } = renderTeamsPage()

      expect(container.textContent).toContain(EMPTY_STATE_TEXT)
      expect(findButtonByText(container, 'Ajouter une équipe')).toBeTruthy()
    })

    it('lists every stored team by name and hides the empty state', () => {
      hydrateTeams([
        makeTeam({ id: 'team-a', name: 'Les Aigles' }).getRawData(),
        makeTeam({ id: 'team-b', name: 'Les Lynx' }).getRawData(),
      ])

      const { container } = renderTeamsPage()

      expect(container.textContent).not.toContain(EMPTY_STATE_TEXT)
      expect(getListedTeamTitles(container)).toEqual(['Les Aigles', 'Les Lynx'])
    })

    it('reflects a team removed from the store without remounting the page', async () => {
      hydrateTeams([
        makeTeam({ id: 'team-a', name: 'Les Aigles' }).getRawData(),
        makeTeam({ id: 'team-b', name: 'Les Lynx' }).getRawData(),
      ])
      const { container } = renderTeamsPage()

      clickElement(findButtonByAriaLabel(container, "Supprimer l'équipe Les Aigles"))
      await flushMacrotasks()
      clickElement(getConfirmButton())
      await flushMacrotasks()

      expect(getListedTeamTitles(container)).toEqual(['Les Lynx'])
    })
  })

  describe('add a team', () => {
    it('opens the new-team form with the add button and hides the list', () => {
      hydrateTeams([makeTeam({ id: 'team-a', name: 'Les Aigles' }).getRawData()])
      const { container } = renderTeamsPage()

      openNewTeamForm(container)

      expect(container.textContent).toContain('Nouvelle équipe')
      expect(container.querySelector('h2')?.textContent).toBe('Nouvelle équipe')
      expect(getListedTeamTitles(container)).toEqual([])
      expect(findButtonByText(container, 'Ajouter')).toBeTruthy()
    })

    it('keeps the save button disabled until the name is filled', () => {
      const { container } = renderTeamsPage()
      openNewTeamForm(container)

      expect(getSaveButton(container).disabled).toBe(true)
      commitInput(findInputByPlaceholder(container, NAME_PLACEHOLDER), 'BCC U09')

      expect(getSaveButton(container).disabled).toBe(false)
    })

    it('adds a named team to the store with the chosen category and players', () => {
      hydratePlayers([makePlayer({ id: 'p1', lastName: 'Durand' }).getRawData()])
      const { container } = renderTeamsPage()
      openNewTeamForm(container)

      commitInput(findInputByPlaceholder(container, NAME_PLACEHOLDER), 'BCC U09')
      chooseOption(findSelect(container), 'U9')
      const [, playerSelect] = container.querySelectorAll<HTMLSelectElement>('select')
      chooseOption(playerSelect, 'p1')
      clickElement(findButtonByText(container, 'Ajouter'))

      const stored = getRawTeams()
      expect(stored).toHaveLength(1)
      expect(stored[0].name).toBe('BCC U09')
      expect(stored[0].category).toBe('U9')
      expect(stored[0].playerIds).toEqual(['p1'])
      expect(storeTeams).toHaveBeenCalledTimes(1)
      expect(getListedTeamTitles(container)).toEqual(['BCC U09'])
    })

    it('submits the form on Enter and stores the team', () => {
      const { container } = renderTeamsPage()
      openNewTeamForm(container)
      commitInput(findInputByPlaceholder(container, NAME_PLACEHOLDER), 'Enter Team')

      pressEnterOn(container.querySelector('form') as HTMLFormElement)

      expect(getRawTeams().map((raw) => raw.name)).toEqual(['Enter Team'])
    })

    it('ignores other keys on the form and stores nothing', () => {
      const { container } = renderTeamsPage()
      openNewTeamForm(container)
      commitInput(findInputByPlaceholder(container, NAME_PLACEHOLDER), 'Typing Team')

      const form = container.querySelector<HTMLFormElement>('form')
      form?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }))

      expect(getRawTeams()).toEqual([])
      expect(container.querySelector('form')).not.toBeNull()
    })

    it('does not store a team when the name is empty, even if save is clicked', () => {
      const { container } = renderTeamsPage()
      openNewTeamForm(container)

      clickElement(getSaveButton(container))

      expect(getRawTeams()).toEqual([])
      expect(storeTeams).not.toHaveBeenCalled()
    })

    it('returns to the list and discards the draft on Annuler', () => {
      const { container } = renderTeamsPage()
      openNewTeamForm(container)
      commitInput(findInputByPlaceholder(container, NAME_PLACEHOLDER), 'Discarded')

      clickElement(findButtonByText(container, 'Annuler'))

      expect(getRawTeams()).toEqual([])
      expect(container.textContent).toContain(EMPTY_STATE_TEXT)
    })
  })

  describe('default match format', () => {
    it('previews the category preset when only a category is chosen', () => {
      const { container } = renderTeamsPage()
      openNewTeamForm(container)

      chooseOption(findSelect(container), 'U13')

      expect(getPreviewText(container)).toBe(
        'Format par défaut : 4 périodes × 8 min × 5 joueurs — 160 min de jeu théoriques. Chaque match part de ce format et garde le sien.'
      )
    })

    it('previews the senior fallback when no category or override is set', () => {
      const { container } = renderTeamsPage()
      openNewTeamForm(container)

      expect(getPreviewText(container)).toContain('4 périodes × 10 min × 5 joueurs — 200 min de jeu théoriques')
    })

    it('applies a valid three-field override and stores it on the saved team', () => {
      const { container } = renderTeamsPage()
      openNewTeamForm(container)
      commitInput(findInputByPlaceholder(container, NAME_PLACEHOLDER), 'Override Team')
      commitInput(findInputByPlaceholder(container, PERIODS_PLACEHOLDER), '2')
      commitInput(findInputByPlaceholder(container, PERIOD_LENGTH_PLACEHOLDER), '12')
      commitInput(findInputByPlaceholder(container, PLAYERS_ON_COURT_PLACEHOLDER), '3')

      expect(getPreviewText(container)).toContain('2 périodes × 12 min × 3 joueurs — 72 min de jeu théoriques')
      expect(container.textContent).not.toContain(FORMAT_HINT_TEXT)

      clickElement(findButtonByText(container, 'Ajouter'))

      expect(getRawTeams()[0].matchFormat).toEqual({ periodLengthMinutes: 12, periods: 2, playersOnCourt: 3 })
    })

    it('shows a hint and keeps the previous format when one override field is not a positive integer', () => {
      const { container } = renderTeamsPage()
      openNewTeamForm(container)
      commitInput(findInputByPlaceholder(container, NAME_PLACEHOLDER), 'Partial Team')
      commitInput(findInputByPlaceholder(container, PERIODS_PLACEHOLDER), '3')
      commitInput(findInputByPlaceholder(container, PERIOD_LENGTH_PLACEHOLDER), '0')
      commitInput(findInputByPlaceholder(container, PLAYERS_ON_COURT_PLACEHOLDER), '5')

      expect(container.textContent).toContain(FORMAT_HINT_TEXT)
      expect(getPreviewText(container)).toContain('4 périodes × 10 min × 5 joueurs')

      clickElement(findButtonByText(container, 'Ajouter'))

      expect(getRawTeams()[0].matchFormat).toBeUndefined()
    })

    it('clears the override back to the category default when the three fields are emptied', () => {
      const { container } = renderTeamsPage()
      openNewTeamForm(container)
      chooseOption(findSelect(container), 'U11')
      commitInput(findInputByPlaceholder(container, PERIODS_PLACEHOLDER), '2')
      commitInput(findInputByPlaceholder(container, PERIOD_LENGTH_PLACEHOLDER), '5')
      commitInput(findInputByPlaceholder(container, PLAYERS_ON_COURT_PLACEHOLDER), '4')
      expect(getPreviewText(container)).toContain('2 périodes × 5 min × 4 joueurs')

      commitInput(findInputByPlaceholder(container, PERIODS_PLACEHOLDER), '')
      commitInput(findInputByPlaceholder(container, PERIOD_LENGTH_PLACEHOLDER), '')
      commitInput(findInputByPlaceholder(container, PLAYERS_ON_COURT_PLACEHOLDER), '')

      expect(container.textContent).not.toContain(FORMAT_HINT_TEXT)
      expect(getPreviewText(container)).toContain('4 périodes × 8 min × 5 joueurs')
    })
  })

  describe('edit a team', () => {
    it('opens the edit form pre-filled with the team and labelled as an edition', () => {
      hydrateTeams([
        makeTeam({
          category: 'U13',
          id: 'team-a',
          matchFormat: { periodLengthMinutes: 7, periods: 3, playersOnCourt: 5 },
          name: 'Les Aigles',
        }).getRawData(),
      ])
      const { container } = renderTeamsPage()

      clickElement(findButtonByAriaLabel(container, "Modifier l'équipe Les Aigles"))

      expect(container.textContent).toContain('Édition de l’équipe')
      expect(findInputByPlaceholder(container, NAME_PLACEHOLDER).value).toBe('Les Aigles')
      expect(findInputByPlaceholder(container, PERIODS_PLACEHOLDER).value).toBe('3')
      expect(getPreviewText(container)).toContain('3 périodes × 7 min × 5 joueurs')
      expect(findButtonByText(container, 'Enregistrer')).toBeTruthy()
    })

    it('updates the stored team in place and persists once', () => {
      hydrateTeams([makeTeam({ id: 'team-a', name: 'Les Aigles' }).getRawData()])
      const { container } = renderTeamsPage()
      clickElement(findButtonByAriaLabel(container, "Modifier l'équipe Les Aigles"))

      commitInput(findInputByPlaceholder(container, NAME_PLACEHOLDER), 'Les Aigles Royaux')
      clickElement(getSaveButton(container))

      expect(getRawTeams()).toHaveLength(1)
      expect(getTeamById('team-a')?.name).toBe('Les Aigles Royaux')
      expect(storeTeams).toHaveBeenCalledTimes(1)
      expect(getListedTeamTitles(container)).toEqual(['Les Aigles Royaux'])
    })

    it('replaces the player selection and the format override of the edited team', () => {
      hydratePlayers([
        makePlayer({ id: 'p1', lastName: 'Durand' }).getRawData(),
        makePlayer({ id: 'p2', lastName: 'Martin' }).getRawData(),
      ])
      hydrateTeams([makeTeam({ id: 'team-a', name: 'Les Aigles', playerIds: ['p1'] }).getRawData()])
      const { container } = renderTeamsPage()
      clickElement(findButtonByAriaLabel(container, "Modifier l'équipe Les Aigles"))

      chooseOption(container.querySelectorAll('select')[1], 'p2')
      commitInput(findInputByPlaceholder(container, PERIODS_PLACEHOLDER), '2')
      commitInput(findInputByPlaceholder(container, PERIOD_LENGTH_PLACEHOLDER), '20')
      commitInput(findInputByPlaceholder(container, PLAYERS_ON_COURT_PLACEHOLDER), '6')
      clickElement(getSaveButton(container))

      expect(getTeamById('team-a')?.playerIds).toEqual(['p1', 'p2'])
      expect(getTeamById('team-a')?.matchFormat).toEqual({ periodLengthMinutes: 20, periods: 2, playersOnCourt: 6 })
    })

    it('keeps the stored team untouched when the edition is cancelled', () => {
      hydrateTeams([makeTeam({ id: 'team-a', name: 'Les Aigles' }).getRawData()])
      const { container } = renderTeamsPage()
      clickElement(findButtonByAriaLabel(container, "Modifier l'équipe Les Aigles"))
      commitInput(findInputByPlaceholder(container, NAME_PLACEHOLDER), 'Renamed but cancelled')

      clickElement(findButtonByText(container, 'Annuler'))

      expect(getTeamById('team-a')?.name).toBe('Les Aigles')
      expect(storeTeams).not.toHaveBeenCalled()
      expect(getListedTeamTitles(container)).toEqual(['Les Aigles'])
    })
  })

  describe('delete a team', () => {
    it('removes the team only after the user confirms', async () => {
      hydrateTeams([makeTeam({ id: 'team-a', name: 'Les Aigles' }).getRawData()])
      const { container } = renderTeamsPage()

      clickElement(findButtonByAriaLabel(container, "Supprimer l'équipe Les Aigles"))
      await flushMacrotasks()
      clickElement(getConfirmButton())
      await flushMacrotasks()

      expect(getRawTeams()).toEqual([])
      expect(storeTeams).toHaveBeenCalledTimes(1)
      expect(container.textContent).toContain(EMPTY_STATE_TEXT)
    })

    it('keeps the team when the user declines the confirmation', async () => {
      hydrateTeams([makeTeam({ id: 'team-a', name: 'Les Aigles' }).getRawData()])
      const { container } = renderTeamsPage()

      clickElement(findButtonByAriaLabel(container, "Supprimer l'équipe Les Aigles"))
      await flushMacrotasks()
      clickElement(getCancelDialogButton())
      await flushMacrotasks()

      expect(getRawTeams().map((raw) => raw.id)).toEqual(['team-a'])
      expect(storeTeams).not.toHaveBeenCalled()
    })
  })

  describe('navigation', () => {
    it('routes to the trombinoscope of the team from its tile link', () => {
      hydrateTeams([makeTeam({ id: 'team-a', name: 'Les Aigles' }).getRawData()])
      const { container } = renderTeamsPage()

      const trombiLink = container.querySelector<HTMLAnchorElement>(
        'a[aria-label="Trombinoscope de l\'équipe Les Aigles"]'
      )
      expect(trombiLink?.getAttribute('href')).toBe('/trombi/team-a')
    })
  })

  describe('player list shown in the form', () => {
    it('offers only the players that are not yet selected in the team', () => {
      hydratePlayers([
        makePlayer({ id: 'p1', lastName: 'Durand' }).getRawData(),
        makePlayer({ id: 'p2', lastName: 'Martin' }).getRawData(),
      ])
      hydrateTeams([makeTeam({ id: 'team-a', name: 'Les Aigles', playerIds: ['p1'] }).getRawData()])
      const { container } = renderTeamsPage()

      clickElement(findButtonByAriaLabel(container, "Modifier l'équipe Les Aigles"))

      const [, playerSelect] = container.querySelectorAll<HTMLSelectElement>('select')
      const optionValues = Array.from(playerSelect.options)
        .map((option) => option.value)
        .filter((value) => value !== '')
      expect(optionValues).toEqual(['p2'])
    })
  })
})
