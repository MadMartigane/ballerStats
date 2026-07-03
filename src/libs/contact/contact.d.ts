export type ContactRelationship = 'mother' | 'father' | 'other'

export type ContactRawData = {
  id?: string
  playerId?: string // foreign key -> Player.id (optional in memory; validated before persisting)
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  address?: string // one-line text, intentionally no validation
  relationship?: ContactRelationship
}
