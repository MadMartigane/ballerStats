import Contact from '../contact/contact'
import type Contacts from './contacts'

/**
 * Strategy used by the contacts editor to read and mutate a contact list.
 * Both the staged draft (new player form / edit-mode draft) and the persisted
 * orchestrator contacts are `Contacts` instances, so a single adapter serves
 * both through the canonical `Contacts` owner.
 *
 * Mutations go through the silent `Contacts` variants so a draft edit never
 * leaks a global `BS::CONTACTS::CHANGE` (which would trigger an orchestrator
 * persist). The editor re-reads the list through `subscribe` instead.
 */
export interface ContactsSource {
  add: (contact: Contact) => void
  createEmpty: () => Contact
  list: () => Contact[]
  remove: (id: string) => void
  /** Local change notifier fired on every draft mutation, without touching the global bus. */
  subscribe: (listener: () => void) => () => void
  update: (contact: Contact) => void
}

export function makeEmptyContact(playerId: string): Contact {
  return new Contact({ playerId, relationship: 'mother' })
}

export function createContactsSource(contacts: Contacts, playerIdGetter: () => string): ContactsSource {
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) {
      listener()
    }
  }
  return {
    add: (contact) => {
      contacts.addSilent(contact)
      notify()
    },
    createEmpty: () => makeEmptyContact(playerIdGetter()),
    list: () => contacts.getByPlayerId(playerIdGetter()),
    remove: (id) => {
      contacts.removeSilent(id)
      notify()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    update: (contact) => {
      contacts.updateContactSilent(contact)
      notify()
    },
  }
}
