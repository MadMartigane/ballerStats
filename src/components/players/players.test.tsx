import { createMemoryHistory, MemoryRouter, Route } from '@solidjs/router'
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ROUTE_TROMBI } from '../../libs/menu/routes'
import { makePlayer } from '../../libs/mock/factories/player.factory'
import { compressPhoto } from '../../libs/photo-compressor/photo-compressor'
import { deletePhotoAndFlag, setPhotoAndFlag } from '../../libs/photo-store/photo-store'
import { storePlayers } from '../../libs/store/store'
import { getRawContacts, hydrateContacts } from '../../libs/stores/contacts-store'
import { getRawPlayers, hydratePlayers } from '../../libs/stores/players-store'
import { confirmAction } from '../../libs/utils/utils'
import { installToastHost, renderInRouter } from '../test-utils'
import BsPlayers from './players'

/**
 * Tests for the players list page, backed by the real module-singleton stores.
 * Every test resets the stores with `hydrate([])`, which never persists. The
 * persistence layer and the confirmation dialog are stubbed so no test touches
 * IndexedDB or a modal, and writes are asserted through the real getters.
 */
vi.mock('../../libs/store/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../libs/store/store')>()
  return {
    ...actual,
    storeContacts: vi.fn(() => Promise.resolve()),
    storePlayers: vi.fn(() => Promise.resolve()),
  }
})

vi.mock('../../libs/utils/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../libs/utils/utils')>()
  return {
    ...actual,
    confirmAction: vi.fn(() => Promise.resolve(true)),
    scrollTop: vi.fn(),
  }
})

vi.mock('../../libs/photo-compressor/photo-compressor', () => ({
  compressPhoto: vi.fn((file: File) => Promise.resolve(file)),
}))

vi.mock('../../libs/photo-store/photo-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../libs/photo-store/photo-store')>()
  return {
    ...actual,
    deletePhoto: vi.fn(() => Promise.resolve()),
    deletePhotoAndFlag: vi.fn(() => Promise.resolve()),
    setPhotoAndFlag: vi.fn(() => Promise.resolve()),
  }
})

const EMPTY_MESSAGE = 'Aucun joueur enregistré.'
const FORM_TITLE_NEW = 'Nouveau joueur'
const FORM_TITLE_EDIT = 'Édition du joueur'
const EDIT_LABEL = 'Modifier le joueur'
const DELETE_LABEL = 'Supprimer le joueur'
const ADD_LABEL = 'Ajouter'
const SAVE_LABEL = 'Enregistrer'
const CANCEL_LABEL = 'Annuler'
const ADD_PLAYER_TEXT = 'Ajouter un joueur'
const TROMBI_TEXT = 'Trombinoscope'

/** A registerable player: first name, last name and jersey number score 30. */
function registerablePlayer(id: string, overrides: Parameters<typeof makePlayer>[0] = {}) {
  return makePlayer({ firstName: 'Ada', id, jerseyNumber: '7', lastName: 'Lovelace', ...overrides }).getRawData()
}

function buttonsByLabel(label: string): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>(`button[aria-label="${label}"]`)]
}

function buttonWithText(text: string): HTMLButtonElement {
  const match = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === text || button.textContent?.includes(text)
  )
  if (!match) {
    throw new Error(`Button with text "${text}" not found`)
  }
  return match
}

/**
 * Returns a footer button of the player tile. Scoped to `.card-actions`, the semantic
 * wrapper that `BsTile` emits around its footer slot. The contact editor's buttons live
 * outside that wrapper, so an exact label match never reaches them.
 */
function formButton(label: string): HTMLButtonElement {
  const match = [...document.querySelectorAll<HTMLButtonElement>('.card-actions button')].find(
    (button) => button.textContent?.trim() === label
  )
  if (!match) {
    throw new Error(`Form button "${label}" not found`)
  }
  return match
}

function inputByLabel(label: string): HTMLInputElement {
  const labelEl = [...document.querySelectorAll<HTMLDivElement>('div.label')].find(
    (element) => element.textContent === label
  )
  const input = labelEl?.closest('label')?.querySelector<HTMLInputElement>('input')
  if (!input) {
    throw new Error(`Input "${label}" not found`)
  }
  return input
}

/** Sets a value and fires the change event that the field listens to. */
function typeInto(label: string, value: string): void {
  const input = inputByLabel(label)
  input.value = value
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Lets the async register and delete promises run to completion. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function fillRegisterableDraft(): void {
  typeInto('Nom', 'Lovelace')
  typeInto('Prénom', 'Ada')
  typeInto('Numéro de maillot', '7')
}

/** Counts error toast dialogs. jsdom does not render `innerText`, so the message text cannot be read. */
function errorToastCount(): number {
  return document.querySelectorAll('#bs-global-toast > div[id^="bs-template-store-alert-error-"]').length
}

function PlayersRoute() {
  return <BsPlayers />
}

let uninstallToastHost: () => void = () => undefined

beforeEach(() => {
  vi.clearAllMocks()
  hydratePlayers([])
  hydrateContacts([])
  uninstallToastHost = installToastHost()
})

afterEach(() => {
  uninstallToastHost()
})

describe('BsPlayers', () => {
  it('shows the empty-roster fallback and no tile when no player is stored', () => {
    renderInRouter(() => <BsPlayers />)

    expect(document.body.textContent).toContain(EMPTY_MESSAGE)
    expect(buttonsByLabel(EDIT_LABEL)).toHaveLength(0)
  })

  it('renders one tile per stored player and hides the empty fallback', () => {
    hydratePlayers([
      registerablePlayer('p1', { nicName: 'The B' }),
      registerablePlayer('p2', { firstName: 'Grace', jerseyNumber: '9', lastName: 'Hopper' }),
    ])

    renderInRouter(() => <BsPlayers />)

    expect(document.body.textContent).not.toContain(EMPTY_MESSAGE)
    expect(buttonsByLabel(EDIT_LABEL)).toHaveLength(2)
    expect(document.body.textContent).toContain('The B')
    expect(document.body.textContent).toContain('Grace Hopper')
  })

  it('opens the new-player form with an empty draft and a disabled save button', () => {
    renderInRouter(() => <BsPlayers />)

    buttonWithText(ADD_PLAYER_TEXT).click()

    expect(document.body.textContent).toContain(FORM_TITLE_NEW)
    expect(inputByLabel('Nom').value).toBe('')
    expect(formButton(ADD_LABEL).disabled).toBe(true)
    expect(getRawPlayers()).toHaveLength(0)
  })

  it('enables the save button only once the draft is registerable', async () => {
    renderInRouter(() => <BsPlayers />)
    buttonWithText(ADD_PLAYER_TEXT).click()

    typeInto('Nom', 'Lovelace')
    typeInto('Prénom', 'Ada')
    await settle()
    expect(formButton(ADD_LABEL).disabled).toBe(true)

    typeInto('Numéro de maillot', '7')
    await settle()
    expect(formButton(ADD_LABEL).disabled).toBe(false)
  })

  it('adds a player to the real store on save and returns to the list', async () => {
    renderInRouter(() => <BsPlayers />)
    buttonWithText(ADD_PLAYER_TEXT).click()
    fillRegisterableDraft()
    await settle()

    formButton(ADD_LABEL).click()
    await settle()

    const stored = getRawPlayers()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ firstName: 'Ada', jerseyNumber: '7', lastName: 'Lovelace' })
    expect(storePlayers).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).not.toContain(FORM_TITLE_NEW)
    expect(buttonsByLabel(EDIT_LABEL)).toHaveLength(1)
  })

  it('saves a registerable new player when Enter is pressed in the form', async () => {
    renderInRouter(() => <BsPlayers />)
    buttonWithText(ADD_PLAYER_TEXT).click()
    fillRegisterableDraft()
    await settle()

    document.querySelector('form')?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    await settle()

    expect(getRawPlayers().map((player) => player.lastName)).toEqual(['Lovelace'])
  })

  it('ignores keys other than Enter in the form', async () => {
    renderInRouter(() => <BsPlayers />)
    buttonWithText(ADD_PLAYER_TEXT).click()
    fillRegisterableDraft()
    await settle()

    document.querySelector('form')?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }))
    await settle()

    expect(getRawPlayers()).toHaveLength(0)
    expect(document.body.textContent).toContain(FORM_TITLE_NEW)
  })

  it('does not save an incomplete player when Enter is pressed', async () => {
    renderInRouter(() => <BsPlayers />)
    buttonWithText(ADD_PLAYER_TEXT).click()
    typeInto('Nom', 'Lovelace')
    await settle()

    document.querySelector('form')?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    await settle()

    expect(getRawPlayers()).toHaveLength(0)
    expect(storePlayers).not.toHaveBeenCalled()
    expect(errorToastCount()).toBe(0)
  })

  it('discards the draft and leaves the store untouched on cancel', async () => {
    renderInRouter(() => <BsPlayers />)
    buttonWithText(ADD_PLAYER_TEXT).click()
    fillRegisterableDraft()
    await settle()

    formButton(CANCEL_LABEL).click()
    await settle()

    expect(getRawPlayers()).toHaveLength(0)
    expect(storePlayers).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain(EMPTY_MESSAGE)
  })

  it('opens the edit form pre-filled from the stored player', () => {
    hydratePlayers([registerablePlayer('p1')])
    renderInRouter(() => <BsPlayers />)

    buttonsByLabel(EDIT_LABEL)[0]?.click()

    expect(document.body.textContent).toContain(FORM_TITLE_EDIT)
    expect(inputByLabel('Nom').value).toBe('Lovelace')
    expect(inputByLabel('Prénom').value).toBe('Ada')
    expect(inputByLabel('Numéro de maillot').value).toBe('7')
    expect(formButton(SAVE_LABEL).disabled).toBe(false)
  })

  it('updates only the edited player in the real store on save', async () => {
    hydratePlayers([
      registerablePlayer('p1'),
      registerablePlayer('p2', { firstName: 'Grace', jerseyNumber: '9', lastName: 'Hopper' }),
    ])
    renderInRouter(() => <BsPlayers />)
    buttonsByLabel(EDIT_LABEL)[0]?.click()

    typeInto('Nom', 'Byron')
    await settle()
    formButton(SAVE_LABEL).click()
    await settle()

    const stored = getRawPlayers()
    expect(stored.find((player) => player.id === 'p1')?.lastName).toBe('Byron')
    expect(stored.find((player) => player.id === 'p2')?.lastName).toBe('Hopper')
    expect(stored).toHaveLength(2)
    expect(storePlayers).toHaveBeenCalledTimes(1)
  })

  it('discards edits and leaves the stored player unchanged on cancel', async () => {
    hydratePlayers([registerablePlayer('p1')])
    renderInRouter(() => <BsPlayers />)
    buttonsByLabel(EDIT_LABEL)[0]?.click()
    typeInto('Nom', 'Byron')
    await settle()

    formButton(CANCEL_LABEL).click()
    await settle()

    expect(getRawPlayers()[0]?.lastName).toBe('Lovelace')
    expect(storePlayers).not.toHaveBeenCalled()
    expect(buttonsByLabel(EDIT_LABEL)).toHaveLength(1)
  })

  it('removes the player from the real store after the confirmation is accepted', async () => {
    hydratePlayers([
      registerablePlayer('p1'),
      registerablePlayer('p2', { firstName: 'Grace', jerseyNumber: '9', lastName: 'Hopper' }),
    ])
    renderInRouter(() => <BsPlayers />)

    buttonsByLabel(DELETE_LABEL)[0]?.click()
    await settle()

    expect(confirmAction).toHaveBeenCalledTimes(1)
    expect(getRawPlayers().map((player) => player.id)).toEqual(['p2'])
    expect(buttonsByLabel(DELETE_LABEL)).toHaveLength(1)
  })

  it('keeps every player when the deletion confirmation is refused', async () => {
    vi.mocked(confirmAction).mockResolvedValueOnce(false)
    hydratePlayers([registerablePlayer('p1')])
    renderInRouter(() => <BsPlayers />)

    buttonsByLabel(DELETE_LABEL)[0]?.click()
    await settle()

    expect(getRawPlayers().map((player) => player.id)).toEqual(['p1'])
    expect(storePlayers).not.toHaveBeenCalled()
  })

  it('navigates to the trombinoscope route from the footer button', async () => {
    const history = createMemoryHistory()
    history.set({ replace: true, scroll: false, value: '/players' })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const dispose = render(
      () => (
        <MemoryRouter history={history}>
          <Route component={PlayersRoute} path="*" />
        </MemoryRouter>
      ),
      container
    )
    try {
      buttonWithText(TROMBI_TEXT).click()
      await settle()

      expect(history.get()).toBe(ROUTE_TROMBI)
    } finally {
      dispose()
      container.remove()
    }
  })

  it('keeps a contact typed into the open editor out of the store', async () => {
    hydratePlayers([registerablePlayer('p1')])
    hydrateContacts([])
    renderInRouter(() => <BsPlayers />)
    buttonsByLabel(EDIT_LABEL)[0]?.click()
    await settle()

    openContactEditor()
    await settle()
    typeIntoLast('Nom', 'Dupont')
    await settle()

    expect(lastInputByLabel('Nom').value).toBe('Dupont')
    expect(getRawContacts()).toHaveLength(0)
    expect(storePlayers).not.toHaveBeenCalled()
  })

  it('stages a contact on save from the contact editor and leaves the store untouched until the player is saved', async () => {
    hydratePlayers([registerablePlayer('p1')])
    hydrateContacts([])
    renderInRouter(() => <BsPlayers />)
    buttonsByLabel(EDIT_LABEL)[0]?.click()
    await settle()

    openContactEditor()
    typeIntoLast('Nom', 'Dupont')
    typeIntoLast('Prénom', 'Marie')
    await settle()
    contactEditorSaveButton().click()
    await settle()

    expect(document.body.textContent).toContain('Marie Dupont')
    expect(getRawContacts()).toHaveLength(0)
    expect(storePlayers).not.toHaveBeenCalled()
  })

  it('leaves the player footer save button alone when the contact editor is saved', async () => {
    hydratePlayers([registerablePlayer('p1')])
    hydrateContacts([])
    renderInRouter(() => <BsPlayers />)
    buttonsByLabel(EDIT_LABEL)[0]?.click()
    await settle()

    openContactEditor()
    typeIntoLast('Nom', 'Dupont')
    await settle()
    contactEditorSaveButton().click()
    await settle()

    expect(formButton(SAVE_LABEL).disabled).toBe(false)
    expect(getRawPlayers()[0]?.lastName).toBe('Lovelace')
    expect(storePlayers).not.toHaveBeenCalled()
  })

  it('removes a staged contact from the list when its delete button is clicked', async () => {
    hydratePlayers([registerablePlayer('p1')])
    hydrateContacts([])
    renderInRouter(() => <BsPlayers />)
    buttonsByLabel(EDIT_LABEL)[0]?.click()
    await settle()

    openContactEditor()
    typeIntoLast('Nom', 'Dupont')
    typeIntoLast('Prénom', 'Marie')
    await settle()
    contactEditorSaveButton().click()
    await settle()
    expect(document.body.textContent).toContain('Marie Dupont')

    buttonsByLabel(DELETE_CONTACT_LABEL)[0]?.click()
    await settle()

    expect(document.body.textContent).not.toContain('Marie Dupont')
    expect(getRawContacts()).toHaveLength(0)
    expect(storePlayers).not.toHaveBeenCalled()
  })

  it('stores the compressed photo with the player when a photo is chosen and saved', async () => {
    const compressed = new Blob(['jpeg'], { type: 'image/jpeg' })
    vi.mocked(compressPhoto).mockResolvedValueOnce(compressed)
    hydratePlayers([registerablePlayer('p1')])
    renderInRouter(() => <BsPlayers />)
    buttonsByLabel(EDIT_LABEL)[0]?.click()
    await settle()

    choosePhoto(new File(['raw'], 'photo.png', { type: 'image/png' }))
    await settle()
    formButton(SAVE_LABEL).click()
    await settle()

    expect(compressPhoto).toHaveBeenCalledTimes(1)
    expect(setPhotoAndFlag).toHaveBeenCalledWith(expect.anything(), compressed)
    expect(getRawPlayers()[0]?.hasPhoto).toBe(true)
  })

  it('deletes the stored photo when the photo is removed and the player is saved', async () => {
    hydratePlayers([registerablePlayer('p1', { hasPhoto: true })])
    renderInRouter(() => <BsPlayers />)
    buttonsByLabel(EDIT_LABEL)[0]?.click()
    await settle()

    buttonWithText(PHOTO_DELETE_TEXT).click()
    await settle()
    formButton(SAVE_LABEL).click()
    await settle()

    expect(deletePhotoAndFlag).toHaveBeenCalledTimes(1)
    expect(getRawPlayers()[0]?.hasPhoto).toBe(false)
  })
})

const DELETE_CONTACT_LABEL = 'Supprimer le contact'
const PHOTO_DELETE_TEXT = 'Supprimer'

const CONTACTS_HEADING = 'Contacts'

/**
 * Returns the contacts section, anchored on its heading. The heading's own parent is
 * only the header row that carries `Ajouter`, so the section is one level above it. That
 * section also holds the contact list and the contact draft with its `Annuler` and
 * `Enregistrer` buttons.
 */
function contactsSection(): HTMLElement {
  const heading = [...document.querySelectorAll<HTMLElement>('h3')].find(
    (element) => element.textContent?.trim() === CONTACTS_HEADING
  )
  const section = heading?.parentElement?.parentElement
  if (!section) {
    throw new Error(`Heading "${CONTACTS_HEADING}" not found`)
  }
  return section
}

/** Opens the contact editor through the "Ajouter" button that lives in the contacts section. */
function openContactEditor(): void {
  const ajouter = [...contactsSection().querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === 'Ajouter'
  )
  if (!ajouter) {
    throw new Error('Contact editor add button not found')
  }
  ajouter.click()
}

/**
 * Returns the contact editor's own save button: the `Enregistrer` inside the contacts
 * section. The contact editor renders without a form element, and the player footer
 * sits in `.card-actions` outside that section, so it is never matched.
 */
function contactEditorSaveButton(): HTMLButtonElement {
  const button = [...contactsSection().querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === SAVE_LABEL
  )
  if (!button) {
    throw new Error('Contact editor save button not found')
  }
  return button
}

/** Types into the last input with the given label, which is the contact draft when the editor is open. */
function typeIntoLast(label: string, value: string): void {
  const input = lastInputByLabel(label)
  input.value = value
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Returns the last input with the given label, which is the contact draft when the editor is open. */
function lastInputByLabel(label: string): HTMLInputElement {
  const labelEls = [...document.querySelectorAll<HTMLDivElement>('div.label')].filter(
    (element) => element.textContent === label
  )
  const input = labelEls.at(-1)?.closest('label')?.querySelector<HTMLInputElement>('input')
  if (!input) {
    throw new Error(`Input "${label}" not found`)
  }
  return input
}

/** Simulates the file input change that `BsPhotoUpload` listens to. */
function choosePhoto(file: File): void {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) {
    throw new Error('Photo file input not found')
  }
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}
