import Contact from '../contact/contact'
import type { ContactRawData } from '../contact/contact.d'
import bsEventBus from '../event-bus/event-bus'

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

  private getContact(newContact: Contact) {
    return this.#contacts.find((current) => current.id === newContact.id)
  }

  get contacts(): Contact[] {
    return this.#contacts.map((contact: Contact): Contact => new Contact(contact.getRawData()))
  }

  get length() {
    return this.#contacts.length
  }

  setFromRawData(data: ContactRawData[]) {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: legacy callers/tests pass null to empty the collection, which the array parameter type does not reflect.
    if (!data) {
      this.#contacts = []
      return
    }

    this.#contacts = data.map((contactData) => new Contact(contactData))
    this.throwUpdatedContactEvent()
  }

  getByPlayerId(playerId: string): Contact[] {
    return this.#contacts
      .filter((contact) => contact.playerId === playerId)
      .map((contact) => new Contact(contact.getRawData()))
  }

  updateContact(newContact: Contact) {
    const oldContact = this.getContact(newContact)
    if (!oldContact) {
      throw new Error(
        `[Contacts.updateContact()] The contact id ${newContact.id} doesn't exist. Please use .add() instead.`
      )
    }

    oldContact.setFromRawData(newContact.getRawData())
    this.throwUpdatedContactEvent()
  }

  getRawData() {
    return this.#contacts.map((contact: Contact) => contact.getRawData())
  }

  add(newContact: Contact) {
    if (!newContact.isRegisterable) {
      throw new Error('[Contacts.add()] Contact is not registerable (missing playerId).')
    }
    const alreadyRegistered = this.getContact(newContact)
    if (alreadyRegistered) {
      throw new Error(`[Contacts.add()] The contact id ${newContact.id} already exists.`)
    }

    this.#contacts.push(newContact)
    this.throwUpdatedContactEvent()
  }

  remove(contact: Contact) {
    const idx = this.#contacts.findIndex((candidate) => candidate.id === contact.id)
    if (idx === -1) {
      throw new Error(`[Contacts.remove()] The contact id ${contact.id} not found.`)
    }

    this.#contacts.splice(idx, 1)
    this.throwUpdatedContactEvent()
  }

  removeSilent(contact: Contact) {
    const idx = this.#contacts.findIndex((candidate) => candidate.id === contact.id)
    if (idx === -1) {
      throw new Error(`[Contacts.removeSilent()] The contact id ${contact.id} not found.`)
    }
    this.#contacts.splice(idx, 1)
  }
}
