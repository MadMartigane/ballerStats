import MadSignal from '../mad-signal'
import { pb } from '../pocketbase/client'
import type { AuthClub, AuthUser, ClubMembersRecord, MembershipRole, ResolvedMembership, UsersRecord } from './auth.d'

export const currentUser: MadSignal<AuthUser | null> = new MadSignal<AuthUser | null>(null)
export const currentClub: MadSignal<AuthClub | null> = new MadSignal<AuthClub | null>(null)
export const currentRole: MadSignal<MembershipRole | null> = new MadSignal<MembershipRole | null>(null)
export const authLoading: MadSignal<boolean> = new MadSignal(false)
export const authError: MadSignal<string | null> = new MadSignal<string | null>(null)

export const ROLE_LABELS: Record<MembershipRole, string> = {
  admin: 'Administrateur',
  owner: 'Propriétaire',
  staff: 'Staff',
}

let initDone = false

export function isLoggedIn(): boolean {
  return currentUser.get() !== null
}

export function canManageStaff(role?: MembershipRole | null): boolean {
  const effectiveRole = role ?? currentRole.get()
  return effectiveRole === 'owner' || effectiveRole === 'admin'
}

/** Picks the first membership of a user (v1: one club assumed). */
export function resolveMembership(memberships: ClubMembersRecord[]): ResolvedMembership | null {
  const [first] = memberships
  const club = first?.expand?.club
  if (!first || !club) {
    return null
  }
  return { club: { id: club.id, name: club.name }, role: first.role }
}

function toAuthUser(model: UsersRecord | null): AuthUser | null {
  if (!model || typeof model.email !== 'string') {
    return null
  }
  return { email: model.email, id: model.id, name: model.name ?? model.email }
}

function resetSession(): void {
  currentUser.set(null)
  currentClub.set(null)
  currentRole.set(null)
}

/** Re-reads the persisted PocketBase session and refreshes club + role. */
export async function loadClubMembership(): Promise<void> {
  if (!pb.authStore.isValid) {
    resetSession()
    return
  }
  const user = toAuthUser(pb.authStore.model as UsersRecord | null)
  if (!user) {
    resetSession()
    return
  }
  currentUser.set(user)
  try {
    const list = await pb.collection<ClubMembersRecord>('club_members').getList(1, 1, {
      expand: 'club',
      filter: pb.filter('user = {:user}', { user: user.id }),
    })
    const resolved = resolveMembership(list.items)
    currentClub.set(resolved?.club ?? null)
    currentRole.set(resolved?.role ?? null)
  } catch {
    currentClub.set(null)
    currentRole.set(null)
  }
}

export async function login(email: string, password: string): Promise<void> {
  authError.set(null)
  authLoading.set(true)
  try {
    await pb.collection('users').authWithPassword(email.trim(), password)
    await loadClubMembership()
  } catch (err) {
    authError.set(err instanceof Error ? err.message : String(err))
    throw err
  } finally {
    authLoading.set(false)
  }
}

export function logout(): void {
  pb.authStore.clear()
  resetSession()
}

/**
 * Idempotent bootstrap: subscribes to auth store changes and loads the
 * persisted session once. Call after mount — never blocks first paint.
 */
export function initAuth(): void {
  if (initDone) {
    return
  }
  initDone = true
  pb.authStore.onChange(() => {
    loadClubMembership()
  })
  loadClubMembership()
}
