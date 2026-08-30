import type { BaseModel } from 'pocketbase'

export type MembershipRole = 'owner' | 'admin' | 'staff'

export interface AuthUser {
  email: string
  id: string
  name: string
}

export interface AuthClub {
  id: string
  name: string
}

export interface ResolvedMembership {
  club: AuthClub
  role: MembershipRole
}

// Minimal PocketBase record shapes used by the auth + staff-invite slices.
export interface UsersRecord extends BaseModel {
  collectionName: 'users'
  email: string
  name?: string
}

export interface ClubsRecord extends BaseModel {
  collectionName: 'clubs'
  name: string
  owner: string
}

export interface ClubMembersRecord extends BaseModel {
  club: string
  collectionName: 'club_members'
  expand?: {
    club?: ClubsRecord
  }
  role: MembershipRole
  user: string
}

export interface TeamRecord extends BaseModel {
  club: string
  collectionName: 'teams'
  name: string
}

// POST /api/baller/invite response (one-time password, no SMTP).
export interface InviteResponse {
  email: string
  password: string
  userId: string
}

// POST /api/baller/users/enrich response item.
export interface EnrichUser {
  email?: string
  id: string
  name?: string
}
