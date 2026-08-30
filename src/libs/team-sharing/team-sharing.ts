import type { ClubMembersRecord, EnrichUser, MembershipRole, TeamRecord } from '../auth/auth.d'
import type { StaffOption, TeamAccess, TeamMembersRecord, TeamShareRow, TeamShareView } from './team-sharing.d'

export const TEAM_ACCESS_OPTIONS: ReadonlyArray<{ label: string; value: TeamAccess }> = [
  { label: 'Lecture', value: 'read' },
  { label: 'Écriture', value: 'write' },
]

const TEAM_ACCESS_VALUES: readonly TeamAccess[] = ['read', 'write']

export function isTeamAccess(value: unknown): value is TeamAccess {
  return typeof value === 'string' && (TEAM_ACCESS_VALUES as readonly string[]).includes(value)
}

export function getTeamAccessLabel(access: TeamAccess): string {
  return TEAM_ACCESS_OPTIONS.find((option) => option.value === access)?.label ?? access
}

/** Owner/admin may manage team sharing (same roles as canManageStaff). */
export function canManageShares(role?: MembershipRole | null): boolean {
  return role === 'owner' || role === 'admin'
}

/** Staff club users become the pool of people that can be granted team access. */
export function buildStaffOptions(
  memberships: ClubMembersRecord[],
  enrichedUsers: Record<string, EnrichUser>
): StaffOption[] {
  return memberships
    .filter((membership) => membership.role === 'staff')
    .map((membership) => {
      const info = enrichedUsers[membership.user]
      return { email: info?.email, name: info?.name, userId: membership.user }
    })
    .sort(byLabel)
}

/** Group the raw team_members rows under their team, resolving member names. */
export function groupSharesByTeam(
  teams: TeamRecord[],
  members: TeamMembersRecord[],
  enrichedUsers: Record<string, EnrichUser>
): TeamShareView[] {
  return teams.map((team) => ({
    members: members
      .filter((member) => member.team === team.id)
      .map((member) => toShareRow(member, enrichedUsers))
      .sort(byLabel),
    teamId: team.id,
    teamName: team.name,
  }))
}

function toShareRow(member: TeamMembersRecord, enrichedUsers: Record<string, EnrichUser>): TeamShareRow {
  const info = enrichedUsers[member.user]
  return {
    access: member.access,
    email: info?.email,
    name: info?.name,
    recordId: member.id,
    userId: member.user,
  }
}

function byLabel(
  left: { email?: string; name?: string; userId: string },
  right: { email?: string; name?: string; userId: string }
): number {
  return labelOf(left).localeCompare(labelOf(right), 'fr')
}

function labelOf(user: { email?: string; name?: string; userId: string }): string {
  return user.name ?? user.email ?? user.userId
}
