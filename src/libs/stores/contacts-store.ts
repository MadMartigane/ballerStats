import { createStore, reconcile } from 'solid-js/store'
import type { ContactRawData } from '../contact/contact.d'
import { storeContacts } from '../store/store'

export function assertContactAddable(existingContacts: ContactRawData[], newContact: ContactRawData): void {
  if (!newContact.playerId) {
    throw new Error('[Contacts.add()] Contact is not registerable (missing playerId).')
  }
  const alreadyRegistered = existingContacts.some((current) => current.id === newContact.id)
  if (alreadyRegistered) {
    throw new Error(`[Contacts.add()] The contact id ${newContact.id} already exists.`)
  }
}

export function assertContactExists(
  existingContacts: ContactRawData[],
  contactOrId: ContactRawData | string
): ContactRawData {
  const id = typeof contactOrId === 'string' ? contactOrId : contactOrId.id
  const contact = existingContacts.find((candidate) => candidate.id === id)
  if (!contact) {
    throw new Error(`[Contacts] The contact id ${id} doesn't exist.`)
  }
  return contact
}

const [contacts, setContacts] = createStore<ContactRawData[]>([])

export { contacts }

export function getRawContacts(): ContactRawData[] {
  return contacts.map((raw) => ({ ...raw }))
}

export function getContactsByPlayerId(playerId: string): ContactRawData[] {
  return contacts.filter((contact) => contact.playerId === playerId).map((contact) => ({ ...contact }))
}

function cloneRaws(raws: ContactRawData[]): ContactRawData[] {
  return raws.map((raw) => ({ ...raw }))
}

function persistContacts(): void {
  storeContacts(getRawContacts()).catch((error: unknown) => {
    console.error('storeContacts failed:', error)
  })
}

/**
 * Load or import a full collection: reconciles the reactive contents without
 * ever persisting. Persistence stays the explicit job of the mutations below.
 */
export function hydrateContacts(raws: ContactRawData[]): void {
  setContacts(reconcile(cloneRaws(raws), { key: 'id' }))
}

/** Replace the whole collection and persist exactly once (imports, demo seed, big clean). */
export function replaceAllContacts(raws: ContactRawData[]): void {
  setContacts(reconcile(cloneRaws(raws), { key: 'id' }))
  persistContacts()
}

export function addContact(raw: ContactRawData): void {
  const next = getRawContacts()
  assertContactAddable(next, raw)
  setContacts([...next, { ...raw }])
  persistContacts()
}

export function updateContact(id: string, raw: ContactRawData): void {
  assertContactExists(contacts, id)
  const index = contacts.findIndex((candidate) => candidate.id === id)
  setContacts(index, { ...raw })
  persistContacts()
}

export function removeContact(contactOrId: ContactRawData | string): void {
  assertContactExists(contacts, contactOrId)
  const id = typeof contactOrId === 'string' ? contactOrId : contactOrId.id
  setContacts((current) => current.filter((contact) => contact.id !== id))
  persistContacts()
}

/**
 * Atomically swap one player's contacts and persist exactly once. Owned by the
 * orchestrator batch commit: the draft has already been validated, so this
 * function does not re-check anything.
 */
export function replacePlayerContacts(playerId: string, raws: ContactRawData[]): void {
  const next = [
    ...getRawContacts().filter((contact) => contact.playerId !== playerId),
    ...raws.map((raw) => ({ ...raw })),
  ]
  setContacts(next)
  persistContacts()
}
