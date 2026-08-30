export interface TeamRawData {
  deletedAt?: number | null // tombstone: ms epoch when soft-deleted, null when live (absent on legacy data)
  id?: string
  name?: string | null
  playerIds?: string[]
  updatedAt?: number // ms epoch of last mutation (0 on legacy data)
}
