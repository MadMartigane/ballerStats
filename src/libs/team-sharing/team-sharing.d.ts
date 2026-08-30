import type { BaseModel } from 'pocketbase'

export type TeamAccess = 'read' | 'write'

// Minimal PocketBase record shape for the team_members collection (see
// 002_collections.js): a club team shared with a club user.
export interface TeamMembersRecord extends BaseModel {
  access: TeamAccess
  club: string
  collectionName: 'team_members'
  team: string
  user: string
}

// One share row rendered per team: user identity + current access.
export interface TeamShareRow {
  access: TeamAccess
  email?: string
  name?: string
  recordId: string
  userId: string
}

// Per-team view of all its shared users (empty members = no share).
export interface TeamShareView {
  members: TeamShareRow[]
  teamId: string
  teamName: string
}

// Club user selectable in the "add share" form (staff members only).
export interface StaffOption {
  email?: string
  name?: string
  userId: string
}
