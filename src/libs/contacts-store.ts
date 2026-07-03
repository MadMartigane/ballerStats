import { createStore } from 'solid-js/store'
import bsEventBus from './event-bus'
import orchestrator from './orchestrator/orchestrator'

const [contacts, setContacts] = createStore(orchestrator.Contacts.contacts)

bsEventBus.addEventListener('BS::CONTACTS::CHANGE', () => {
  setContacts(orchestrator.Contacts.contacts)
})

export { contacts }
