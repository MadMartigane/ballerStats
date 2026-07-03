import Contact, { type ContactRawData } from '../contact'
import bsEventBus from '../event-bus'

export default class Contacts {
  #contacts: Array<Contact> = []

  constructor(contactDatas?: Array<ContactRawData>) {
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

  public get contacts(): Array<Contact> {
    return this.#contacts.map((contact: Contact): Contact => new Contact(contact.getRawData()))
  }

  public get length() {
    return this.#contacts.length
  }

  public setFromRawData(data: Array<ContactRawData>) {
    if (!data) {
      this.#contacts = []
      return
    }

    this.#contacts = data.map((contactData) => new Contact(contactData))
    this.throwUpdatedContactEvent()
  }

  public getByPlayerId(playerId: string): Array<Contact> {
    return this.#contacts
      .filter((contact) => contact.playerId === playerId)
      .map((contact) => new Contact(contact.getRawData()))
  }

  public updateContact(newContact: Contact) {
    const oldContact = this.getContact(newContact)
    if (!oldContact) {
      throw new Error(
        `[Contacts.updateContact()] The contact id ${newContact.id} doesn't exist. Please use .add() instead.`
      )
    }

    oldContact.setFromRawData(newContact.getRawData())
    this.throwUpdatedContactEvent()
  }

  public getRawData() {
    return this.#contacts.map((contact: Contact) => contact.getRawData())
  }

  public add(newContact: Contact) {
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

  public remove(contact: Contact) {
    const idx = this.#contacts.findIndex((candidate) => candidate.id === contact.id)
    if (idx === -1) {
      throw new Error(`[Contacts.remove()] The contact id ${contact.id} not found.`)
    }

    this.#contacts.splice(idx, 1)
    this.throwUpdatedContactEvent()
  }

  public removeSilent(contact: Contact) {
    const idx = this.#contacts.findIndex((candidate) => candidate.id === contact.id)
    if (idx === -1) {
      throw new Error(`[Contacts.removeSilent()] The contact id ${contact.id} not found.`)
    }
    this.#contacts.splice(idx, 1)
  }
}
