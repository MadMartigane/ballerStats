import { render } from 'solid-js/web'
import { afterEach, describe, expect, it } from 'vitest'
import Contact from '../../libs/contact/contact'
import type { ContactRawData } from '../../libs/contact/contact.d'
import { createContactsSource } from '../../libs/contacts/contacts-source'
import { Orchestrator } from '../../libs/orchestrator/orchestrator'
import BsContactsEditor from './contacts-editor'

const PLAYER_ID = 'p1'

function makeContactData(overrides: Partial<ContactRawData> = {}): ContactRawData {
  return {
    id: 'c1',
    playerId: PLAYER_ID,
    relationship: 'mother',
    ...overrides,
  }
}

describe('BsContactsEditor', () => {
  let dispose: (() => void) | undefined

  afterEach(() => {
    dispose?.()
    dispose = undefined
    document.body.innerHTML = ''
  })

  it('shows a newly added contact row without remounting', () => {
    const orchestrator = new Orchestrator()
    const source = createContactsSource(orchestrator.Contacts, () => PLAYER_ID)

    dispose = render(() => <BsContactsEditor source={source} />, document.body)

    expect(document.body.textContent).toContain('Aucun contact enregistré pour ce joueur.')

    const addButton = document.querySelector('button')

    orchestrator.Contacts.add(new Contact(makeContactData({ firstName: 'Marie', id: 'c1', lastName: 'Dupont' })))

    expect(document.body.textContent).toContain('Marie Dupont')
    expect(document.body.textContent).not.toContain('Aucun contact enregistré pour ce joueur.')
    expect(document.querySelector('button')).toBe(addButton)
  })
})
