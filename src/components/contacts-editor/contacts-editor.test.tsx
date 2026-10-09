import { createStore } from 'solid-js/store'
import { describe, expect, it } from 'vitest'
import type { ContactRawData } from '../../libs/contact/contact.d'
import { renderView } from '../test-utils'
import BsContactsEditor from './contacts-editor'

const PLAYER_ID = 'p1'

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
