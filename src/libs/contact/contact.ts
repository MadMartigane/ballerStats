import { getUniqId } from '../utils'
import type { ContactRawData, ContactRelationship } from './contact.d'

export const CONTACT_RELATIONSHIPS: ReadonlyArray<ContactRelationship> = ['mother', 'father', 'other']

export const RELATIONSHIP_LABELS: ReadonlyArray<{ value: ContactRelationship; label: string }> = [
  { value: 'mother', label: 'Mère' },
  { value: 'father', label: 'Père' },
  { value: 'other', label: 'Autre' },
]

export function isContactRelationship(value: unknown): value is ContactRelationship {
  return typeof value === 'string' && (CONTACT_RELATIONSHIPS as readonly string[]).includes(value)
}

export function getRelationshipLabel(relationship: ContactRelationship): string {
  return RELATIONSHIP_LABELS.find((entry) => entry.value === relationship)?.label || relationship
}

export default class Contact {
  #id: string
  public playerId?: string
  public firstName?: string
  public lastName?: string
  public phone?: string
  public email?: string
  public address?: string
  public relationship: ContactRelationship = 'other' as ContactRelationship

  constructor(data?: ContactRawData) {
    this.#id = data?.id || getUniqId()

    if (data) {
      this.setFromRawData(data)
    } else {
      this.playerId = ''
      this.relationship = 'other'
    }
  }

  public get id() {
    return this.#id
  }

  public get isRegisterable(): boolean {
    return Boolean(this.playerId)
  }

  public setFromRawData(data: ContactRawData) {
    if (data.id) {
      this.#id = data.id
    }
    this.playerId = data.playerId
    this.firstName = data.firstName
    this.lastName = data.lastName
    this.phone = data.phone
    this.email = data.email
    this.address = data.address
    this.relationship = isContactRelationship(data.relationship) ? data.relationship : 'other'
  }

  public getRawData(): ContactRawData {
    const data: ContactRawData = {
      id: this.#id,
      playerId: this.playerId,
      relationship: this.relationship,
    }

    if (this.firstName) {
      data.firstName = this.firstName
    }
    if (this.lastName) {
      data.lastName = this.lastName
    }
    if (this.phone) {
      data.phone = this.phone
    }
    if (this.email) {
      data.email = this.email
    }
    if (this.address) {
      data.address = this.address
    }

    return data
  }

  public update(data: Partial<ContactRawData>) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
  }
}
