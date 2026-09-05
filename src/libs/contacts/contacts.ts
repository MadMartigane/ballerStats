import Contact from '../contact/contact'
import type { ContactRawData } from '../contact/contact.d'
import bsEventBus from '../event-bus/event-bus'

export function assertContactAddable(contacts: Contact[], newContact: Contact) {
  if (!newContact.isRegisterable) {
    throw new Error('[Contacts.add()] Contact is not registerable (missing playerId).')
  }
  const alreadyRegistered = contacts.some((current) => current.id === newContact.id)
  if (alreadyRegistered) {
    throw new Error(`[Contacts.add()] The contact id ${newContact.id} already exists.`)
  }
}

export function assertContactExists(contacts: Contact[], contactOrId: Contact | string): Contact {
  const id = typeof contactOrId === 'string' ? contactOrId : contactOrId.id
  const contact = contacts.find((candidate) => candidate.id === id)
  if (!contact) {
    throw new Error(`[Contacts] The contact id ${id} doesn't exist.`)
  }
  return contact
}

export default class Contacts {
  #contacts: Contact[] = []

  constructor(contactDatas?: ContactRawData[]) {
    if (contactDatas) {
      this.setFromRawData(contactDatas)
    }
  }

  private throwUpdatedContactEvent() {
    bsEventBus.dispatchEvent('BS::CONTACTS::CHANGE')
  }

  get contacts(): Contact[] {
    return this.#contacts.map((contact: Contact): Contact => new Contact(contact.getRawData()))
  }

  get length() {
    return this.#contacts.length
  }

  setFromRawDataSilent(data: ContactRawData[]) {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: legacy callers/tests pass null to empty the collection, which the array parameter type does not reflect.
    if (!data) {
      this.#contacts = []
      return
    }

    this.#contacts = data.map((contactData) => new Contact(contactData))
  }

  setFromRawData(data: ContactRawData[]) {
    this.setFromRawDataSilent(data)
    this.throwUpdatedContactEvent()
  }

  getByPlayerId(playerId: string): Contact[] {
    return this.#contacts
      .filter((contact) => contact.playerId === playerId)
      .map((contact) => new Contact(contact.getRawData()))
  }

  updateContactSilent(newContact: Contact) {
    const oldContact = assertContactExists(this.#contacts, newContact)
    oldContact.setFromRawData(newContact.getRawData())
  }

  updateContact(newContact: Contact) {
    this.updateContactSilent(newContact)
    this.throwUpdatedContactEvent()
  }

  getRawData() {
    return this.#contacts.map((contact: Contact) => contact.getRawData())
  }

  add(newContact: Contact) {
    this.addSilent(newContact)
    this.throwUpdatedContactEvent()
  }

  addSilent(newContact: Contact) {
    assertContactAddable(this.#contacts, newContact)
    this.#contacts.push(newContact)
  }

  remove(contactOrId: Contact | string) {
    this.removeSilent(contactOrId)
    this.throwUpdatedContactEvent()
  }

  removeSilent(contactOrId: Contact | string) {
    const existing = assertContactExists(this.#contacts, contactOrId)
    const idx = this.#contacts.indexOf(existing)
    this.#contacts.splice(idx, 1)
  }
}
