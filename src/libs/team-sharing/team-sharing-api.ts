import type { TeamRecord } from '../auth/auth.d'
import { pb } from '../pocketbase/client'
import type { TeamAccess, TeamMembersRecord } from './team-sharing.d'

export interface ClubTeamShares {
  members: TeamMembersRecord[]
  teams: TeamRecord[]
}

// team_members.listRule scopes the fetch to the caller's own club, and teams
// are filtered explicitly (club owner/admin roles only reach the page).
export async function listClubTeamShares(clubId: string): Promise<ClubTeamShares> {
  const teams = (await pb.collection<TeamRecord>('teams').getFullList({
    filter: pb.filter('club = {:club}', { club: clubId }),
  })) as TeamRecord[]
  const members = (await pb.collection<TeamMembersRecord>('team_members').getFullList({})) as TeamMembersRecord[]
  return { members, teams }
}

export function createTeamShare(
  clubId: string,
  teamId: string,
  userId: string,
  access: TeamAccess
): Promise<TeamMembersRecord> {
  return pb.collection<TeamMembersRecord>('team_members').create({ access, club: clubId, team: teamId, user: userId })
}

export function updateTeamShare(recordId: string, access: TeamAccess): Promise<TeamMembersRecord> {
  return pb.collection<TeamMembersRecord>('team_members').update(recordId, { access })
}

export function deleteTeamShare(recordId: string): Promise<boolean> {
  return pb.collection<TeamMembersRecord>('team_members').delete(recordId)
}
