import { getUniqId } from '../utils/utils'
import type { ContactRawData, ContactRelationship } from './contact.d'

export const CONTACT_RELATIONSHIPS: readonly ContactRelationship[] = ['mother', 'father', 'other']

export const RELATIONSHIP_LABELS: ReadonlyArray<{ value: ContactRelationship; label: string }> = [
  { label: 'Mère', value: 'mother' },
  { label: 'Père', value: 'father' },
  { label: 'Autre', value: 'other' },
]

export function isContactRelationship(value: unknown): value is ContactRelationship {
  return typeof value === 'string' && (CONTACT_RELATIONSHIPS as readonly string[]).includes(value)
}

export function getRelationshipLabel(relationship: ContactRelationship): string {
  return RELATIONSHIP_LABELS.find((entry) => entry.value === relationship)?.label || relationship
}

export default class Contact {
  #id: string
  #updatedAt: number
  #deletedAt: number | null
  playerId?: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  address?: string
  relationship: ContactRelationship = 'other' as ContactRelationship

  constructor(data?: ContactRawData) {
    this.#id = data?.id || getUniqId()
    this.#updatedAt = data?.updatedAt ?? (data?.id ? 0 : Date.now())
    this.#deletedAt = data?.deletedAt ?? null

    if (data) {
      this.setFromRawData(data)
    } else {
      this.playerId = ''
      this.relationship = 'other'
    }
  }

  get id() {
    return this.#id
  }

  get updatedAt() {
    return this.#updatedAt
  }

  get deletedAt() {
    return this.#deletedAt
  }

  /** Stamp the entity as modified now. Mutable operations must call this. */
  private touch() {
    this.#updatedAt = Date.now()
  }

  /** Soft-delete: keep the record, stamp it as deleted. */
  markAsDeleted() {
    this.#deletedAt = Date.now()
    this.touch()
  }

  get isRegisterable(): boolean {
    return Boolean(this.playerId)
  }

  setFromRawData(data: ContactRawData) {
    if (data.id) {
      this.#id = data.id
    }
    if (data.updatedAt !== undefined) {
      this.#updatedAt = data.updatedAt
    }
    if (data.deletedAt !== undefined) {
      this.#deletedAt = data.deletedAt
    }
    this.playerId = data.playerId
    this.firstName = data.firstName
    this.lastName = data.lastName
    this.phone = data.phone
    this.email = data.email
    this.address = data.address
    this.relationship = isContactRelationship(data.relationship) ? data.relationship : 'other'
  }

  getRawData(): ContactRawData {
    const data: ContactRawData = {
      deletedAt: this.#deletedAt,
      id: this.#id,
      playerId: this.playerId,
      relationship: this.relationship,
      updatedAt: this.#updatedAt,
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

  update(data: Partial<ContactRawData>) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
    this.touch()
  }
}
