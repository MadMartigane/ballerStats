export type ContactRelationship = 'mother' | 'father' | 'other'

export interface ContactRawData {
  address?: string // one-line text, intentionally no validation
  deletedAt?: number | null // tombstone: ms epoch when soft-deleted, null when live (absent on legacy data)
  email?: string
  firstName?: string
  id?: string
  lastName?: string
  phone?: string
  playerId?: string // foreign key -> Player.id (optional in memory; validated before persisting)
  relationship?: ContactRelationship
  updatedAt?: number // ms epoch of last mutation (0 on legacy data)
}
