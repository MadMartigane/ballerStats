export type ContactRelationship = 'mother' | 'father' | 'other'

export interface ContactRawData {
  address?: string // one-line text, intentionally no validation
  email?: string
  firstName?: string
  id?: string
  lastName?: string
  phone?: string
  playerId?: string // foreign key -> Player.id (optional in memory; validated before persisting)
  relationship?: ContactRelationship
}
