import { createStore } from 'solid-js/store'
import { describe, expect, it, vi } from 'vitest'
import type { ContactRawData } from '../../libs/contact/contact.d'
import { renderView } from '../test-utils'
import BsContactsEditor from './contacts-editor'

const PLAYER_ID = 'p1'
const ERROR_TOAST_ID_PREFIX = 'bs-template-store-alert-error-'

const noop = (): void => undefined

function makeContactData(overrides: Partial<ContactRawData> = {}): ContactRawData {
  return {
    id: 'c1',
    playerId: PLAYER_ID,
    relationship: 'mother',
    ...overrides,
  }
}

describe('BsContactsEditor', () => {
  it('shows a newly added contact row without remounting', () => {
    const [contacts, setContacts] = createStore<ContactRawData[]>([])
    const onAdd = (contact: ContactRawData) => setContacts((prev) => [...prev, contact])

    renderView(() => <BsContactsEditor contacts={contacts} onAdd={onAdd} onRemove={noop} onUpdate={noop} />)

    expect(document.body.textContent).toContain('Aucun contact enregistré pour ce joueur.')

    const addButton = document.querySelector('button')

    onAdd(makeContactData({ firstName: 'Marie', id: 'c1', lastName: 'Dupont' }))

    expect(document.body.textContent).toContain('Marie Dupont')
    expect(document.body.textContent).not.toContain('Aucun contact enregistré pour ce joueur.')
    expect(document.querySelector('button')).toBe(addButton)
  })
})

/**
 * Mirrors the real `#bs-template-store` from index.tsx so `toast` can clone a template.
 * Returns a cleanup function that removes everything it added.
 */
function installToastFixture(): () => void {
  const store = document.createElement('div')
  store.id = 'bs-template-store'
  for (const variant of ['info', 'success', 'warning', 'error']) {
    const template = document.createElement('div')
    template.id = `bs-template-store-alert-${variant}`
    const message = document.createElement('span')
    message.id = 'message'
    template.append(message)
    store.append(template)
  }
  const container = document.createElement('div')
  container.id = 'bs-global-toast'
  document.body.append(store, container)
  return () => {
    store.remove()
    container.remove()
  }
}

function errorToastCount(): number {
  return [...document.querySelectorAll('#bs-global-toast > div')].filter((toastEl) =>
    toastEl.id.startsWith(ERROR_TOAST_ID_PREFIX)
  ).length
}

function queryButton(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    button.textContent?.includes(label)
  )
}

function requireButton(label: string): HTMLButtonElement {
  const button = queryButton(label)
  if (!button) {
    throw new Error(`No button containing "${label}"`)
  }
  return button
}

function click(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function fieldInput(label: string): HTMLInputElement {
  const labelEl = [...document.querySelectorAll('label')].find((candidate) => candidate.textContent?.includes(label))
  const input = labelEl?.querySelector<HTMLInputElement>('input')
  if (!input) {
    throw new Error(`No input for "${label}"`)
  }
  return input
}

function typeInto(label: string, value: string): void {
  const input = fieldInput(label)
  input.value = value
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('BsContactsEditor list display', () => {
  it('renders each contact with its name, relationship, phone and email', () => {
    const contacts = [
      makeContactData({ email: 'm@x.fr', firstName: 'Marie', id: 'c1', lastName: 'Dupont', phone: '0612345678' }),
      makeContactData({ firstName: 'Paul', id: 'c2', lastName: 'Martin', relationship: 'father' }),
    ]
    renderView(() => <BsContactsEditor contacts={contacts} onAdd={noop} onRemove={noop} onUpdate={noop} />)

    const text = document.body.textContent ?? ''
    expect(text).toContain('Marie Dupont')
    expect(text).toContain('Mère')
    expect(text).toContain('0612345678')
    expect(text).toContain('m@x.fr')
    expect(text).toContain('Paul Martin')
    expect(text).toContain('Père')
  })

  it('omits the phone and email rows when those fields are absent', () => {
    renderView(() => (
      <BsContactsEditor
        contacts={[makeContactData({ firstName: 'Léa', id: 'c1', lastName: 'Roux' })]}
        onAdd={noop}
        onRemove={noop}
        onUpdate={noop}
      />
    ))
    expect(document.querySelector('[class*="lucide-phone"], svg.lucide-phone')).toBeNull()
    expect(document.querySelector('svg.lucide-mail')).toBeNull()
  })

  it('shows the phone and email icons when those fields are present', () => {
    renderView(() => (
      <BsContactsEditor
        contacts={[makeContactData({ email: 'a@b.fr', id: 'c1', phone: '0600000000' })]}
        onAdd={noop}
        onRemove={noop}
        onUpdate={noop}
      />
    ))
    expect(document.querySelector('svg.lucide-phone')).not.toBeNull()
    expect(document.querySelector('svg.lucide-mail')).not.toBeNull()
  })

  it('hides the add button and the list while the editor is open', () => {
    renderView(() => (
      <BsContactsEditor
        contacts={[makeContactData({ firstName: 'A', id: 'c1' })]}
        onAdd={noop}
        onRemove={noop}
        onUpdate={noop}
      />
    ))
    click(requireButton('Ajouter'))
    expect(queryButton('Ajouter')).toBeUndefined()
    expect(document.body.textContent).not.toContain('A ')
    expect(document.querySelector('[aria-label="Modifier le contact"]')).toBeNull()
  })

  it('shows the empty message when there are no contacts and no draft', () => {
    renderView(() => <BsContactsEditor contacts={[]} onAdd={noop} onRemove={noop} onUpdate={noop} />)
    expect(document.body.textContent).toContain('Aucun contact enregistré pour ce joueur.')
    expect(requireButton('Ajouter')).toBeInstanceOf(HTMLButtonElement)
  })
})

describe('BsContactsEditor adding', () => {
  it('opens a blank mother-relationship draft when Ajouter is clicked', () => {
    renderView(() => <BsContactsEditor contacts={[]} onAdd={noop} onRemove={noop} onUpdate={noop} />)
    click(requireButton('Ajouter'))
    expect(fieldInput('Nom').value).toBe('')
    expect(fieldInput('Prénom').value).toBe('')
    expect(document.querySelector<HTMLSelectElement>('select')?.value).toBe('mother')
  })

  it('calls onAdd with the typed draft and closes the editor on Enregistrer', () => {
    const onAdd = vi.fn<(contact: ContactRawData) => void>()
    renderView(() => <BsContactsEditor contacts={[]} onAdd={onAdd} onRemove={noop} onUpdate={noop} />)
    click(requireButton('Ajouter'))
    typeInto('Nom', 'Dupont')
    typeInto('Prénom', 'Marie')
    typeInto('Téléphone', '0600000000')
    typeInto('Email', 'marie@x.fr')
    typeInto('Adresse', '1 rue A')
    click(requireButton('Enregistrer'))

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd.mock.calls[0][0]).toMatchObject({
      address: '1 rue A',
      email: 'marie@x.fr',
      firstName: 'Marie',
      lastName: 'Dupont',
      phone: '0600000000',
      relationship: 'mother',
    })
    expect(queryButton('Enregistrer')).toBeUndefined()
    expect(queryButton('Ajouter')).toBeInstanceOf(HTMLButtonElement)
  })

  it('applies a relationship change from the select to the draft', () => {
    const onAdd = vi.fn<(contact: ContactRawData) => void>()
    renderView(() => <BsContactsEditor contacts={[]} onAdd={onAdd} onRemove={noop} onUpdate={noop} />)
    click(requireButton('Ajouter'))
    const select = document.querySelector<HTMLSelectElement>('select')
    if (!select) {
      throw new Error('No relationship select')
    }
    select.value = 'father'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    click(requireButton('Enregistrer'))
    expect(onAdd.mock.calls[0][0].relationship).toBe('father')
  })

  it('discards the draft and calls nothing on Annuler', () => {
    const onAdd = vi.fn<(contact: ContactRawData) => void>()
    const onUpdate = vi.fn<(contact: ContactRawData) => void>()
    renderView(() => <BsContactsEditor contacts={[]} onAdd={onAdd} onRemove={noop} onUpdate={onUpdate} />)
    click(requireButton('Ajouter'))
    typeInto('Nom', 'Jeté')
    click(requireButton('Annuler'))
    expect(onAdd).not.toHaveBeenCalled()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Aucun contact enregistré pour ce joueur.')
  })

  it('shows an error toast and keeps the draft open when onAdd throws', () => {
    const onAdd = (): void => {
      throw new Error('boom')
    }
    const removeFixture = installToastFixture()
    renderView(() => <BsContactsEditor contacts={[]} onAdd={onAdd} onRemove={noop} onUpdate={noop} />)
    click(requireButton('Ajouter'))
    click(requireButton('Enregistrer'))
    expect(queryButton('Enregistrer')).toBeInstanceOf(HTMLButtonElement)
    expect(errorToastCount()).toBe(1)
    removeFixture()
  })
})

describe('BsContactsEditor editing and deleting', () => {
  const existing = makeContactData({ firstName: 'Marie', id: 'c1', lastName: 'Dupont' })

  it('opens the editor pre-filled with the chosen contact', () => {
    renderView(() => <BsContactsEditor contacts={[existing]} onAdd={noop} onRemove={noop} onUpdate={noop} />)
    click(document.querySelector<HTMLButtonElement>('[aria-label="Modifier le contact"]') as HTMLButtonElement)
    expect(fieldInput('Nom').value).toBe('Dupont')
    expect(fieldInput('Prénom').value).toBe('Marie')
  })

  it('calls onUpdate, not onAdd, when saving an edited contact', () => {
    const onAdd = vi.fn<(contact: ContactRawData) => void>()
    const onUpdate = vi.fn<(contact: ContactRawData) => void>()
    renderView(() => <BsContactsEditor contacts={[existing]} onAdd={onAdd} onRemove={noop} onUpdate={onUpdate} />)
    click(document.querySelector<HTMLButtonElement>('[aria-label="Modifier le contact"]') as HTMLButtonElement)
    typeInto('Prénom', 'Lucie')
    click(requireButton('Enregistrer'))

    expect(onAdd).not.toHaveBeenCalled()
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate.mock.calls[0][0]).toMatchObject({ firstName: 'Lucie', id: 'c1', lastName: 'Dupont' })
  })

  it('calls onRemove with the contact id on delete', () => {
    const onRemove = vi.fn<(id: string) => void>()
    renderView(() => <BsContactsEditor contacts={[existing]} onAdd={noop} onRemove={onRemove} onUpdate={noop} />)
    click(document.querySelector<HTMLButtonElement>('[aria-label="Supprimer le contact"]') as HTMLButtonElement)
    expect(onRemove).toHaveBeenCalledWith('c1')
  })

  it('passes an empty id when deleting a contact that has none', () => {
    const onRemove = vi.fn<(id: string) => void>()
    const anonymous = { ...makeContactData({ firstName: 'Z' }), id: undefined } as unknown as ContactRawData
    renderView(() => <BsContactsEditor contacts={[anonymous]} onAdd={noop} onRemove={onRemove} onUpdate={noop} />)
    click(document.querySelector<HTMLButtonElement>('[aria-label="Supprimer le contact"]') as HTMLButtonElement)
    expect(onRemove).toHaveBeenCalledWith('')
  })

  it('shows an error toast when onRemove throws', () => {
    const removeFixture = installToastFixture()
    const onRemove = (): void => {
      throw new Error('boom')
    }
    renderView(() => <BsContactsEditor contacts={[existing]} onAdd={noop} onRemove={onRemove} onUpdate={noop} />)
    expect(() =>
      click(document.querySelector<HTMLButtonElement>('[aria-label="Supprimer le contact"]') as HTMLButtonElement)
    ).not.toThrow()
    expect(errorToastCount()).toBe(1)
    removeFixture()
  })

  it('discards an edit without calling onUpdate on Annuler', () => {
    const onUpdate = vi.fn<(contact: ContactRawData) => void>()
    renderView(() => <BsContactsEditor contacts={[existing]} onAdd={noop} onRemove={noop} onUpdate={onUpdate} />)
    click(document.querySelector<HTMLButtonElement>('[aria-label="Modifier le contact"]') as HTMLButtonElement)
    typeInto('Prénom', 'Jeté')
    click(requireButton('Annuler'))
    expect(onUpdate).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Marie Dupont')
  })
})
