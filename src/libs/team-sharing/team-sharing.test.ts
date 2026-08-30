import { describe, expect, it } from 'vitest'
import type { ClubMembersRecord, EnrichUser, TeamRecord } from '../auth/auth.d'
import {
  buildStaffOptions,
  canManageShares,
  getTeamAccessLabel,
  groupSharesByTeam,
  isTeamAccess,
  TEAM_ACCESS_OPTIONS,
} from './team-sharing'
import type { TeamMembersRecord } from './team-sharing.d'

function team(overrides: Partial<TeamRecord> = {}): TeamRecord {
  return {
    club: 'club-1',
    collectionId: 'pbc_teams',
    collectionName: 'teams',
    created: '',
    id: 'team-1',
    name: 'U13',
    updated: '',
    ...overrides,
  } as unknown as TeamRecord
}

function membership(overrides: Partial<ClubMembersRecord> = {}): ClubMembersRecord {
  return {
    club: 'club-1',
    collectionId: 'pbc_members',
    collectionName: 'club_members',
    created: '',
    id: 'membership-1',
    role: 'staff',
    updated: '',
    user: 'user-1',
    ...overrides,
  } as unknown as ClubMembersRecord
}

function share(overrides: Partial<TeamMembersRecord> = {}): TeamMembersRecord {
  return {
    access: 'read',
    club: 'club-1',
    collectionId: 'pbc_tm',
    collectionName: 'team_members',
    created: '',
    id: 'tm-1',
    team: 'team-1',
    updated: '',
    user: 'user-1',
    ...overrides,
  } as unknown as TeamMembersRecord
}

const USERS: Record<string, EnrichUser> = {
  'user-1': { email: 'alice@baller.fr', id: 'user-1', name: 'Alice' },
  'user-2': { email: 'bob@baller.fr', id: 'user-2', name: 'Bob' },
}

describe('isTeamAccess', () => {
  it('accepts read and write only', () => {
    expect(isTeamAccess('read')).toBe(true)
    expect(isTeamAccess('write')).toBe(true)
    expect(isTeamAccess('owner')).toBe(false)
    expect(isTeamAccess('')).toBe(false)
    expect(isTeamAccess(null)).toBe(false)
  })
})

describe('getTeamAccessLabel', () => {
  it('maps read/write to French labels', () => {
    expect(getTeamAccessLabel('read')).toBe('Lecture')
    expect(getTeamAccessLabel('write')).toBe('Écriture')
  })

  it('exposes the two selectable options', () => {
    expect(TEAM_ACCESS_OPTIONS).toEqual([
      { label: 'Lecture', value: 'read' },
      { label: 'Écriture', value: 'write' },
    ])
  })
})

describe('canManageShares', () => {
  it('is true only for owner and admin', () => {
    expect(canManageShares('owner')).toBe(true)
    expect(canManageShares('admin')).toBe(true)
    expect(canManageShares('staff')).toBe(false)
    expect(canManageShares(null)).toBe(false)
    expect(canManageShares(undefined)).toBe(false)
  })
})

describe('buildStaffOptions', () => {
  it('keeps staff members only and resolves names', () => {
    const options = buildStaffOptions(
      [
        membership({ id: 'm-staff', user: 'user-1' }),
        membership({ id: 'm-admin', role: 'admin', user: 'user-2' }),
        membership({ id: 'm-owner', role: 'owner', user: 'user-3' }),
      ],
      USERS
    )
    expect(options).toEqual([{ email: 'alice@baller.fr', name: 'Alice', userId: 'user-1' }])
  })

  it('falls back to the raw user id when the user is not enriched', () => {
    expect(buildStaffOptions([membership({ user: 'user-9' })], USERS)).toEqual([
      { email: undefined, name: undefined, userId: 'user-9' },
    ])
  })
})

describe('groupSharesByTeam', () => {
  it('groups members under their team, keeping the team order', () => {
    const view = groupSharesByTeam(
      [team({ id: 'team-1', name: 'U13' }), team({ id: 'team-2', name: 'U15' })],
      [
        share({ access: 'write', id: 'tm-a', team: 'team-2', user: 'user-2' }),
        share({ access: 'read', id: 'tm-b', team: 'team-1', user: 'user-1' }),
      ],
      USERS
    )
    expect(view.map((entry) => entry.teamName)).toEqual(['U13', 'U15'])
    expect(view[0].members).toEqual([
      { access: 'read', email: 'alice@baller.fr', name: 'Alice', recordId: 'tm-b', userId: 'user-1' },
    ])
    expect(view[1].members).toEqual([
      { access: 'write', email: 'bob@baller.fr', name: 'Bob', recordId: 'tm-a', userId: 'user-2' },
    ])
  })

  it('includes teams without any share as empty groups', () => {
    const view = groupSharesByTeam([team()], [], USERS)
    expect(view).toEqual([{ members: [], teamId: 'team-1', teamName: 'U13' }])
  })

  it('falls back to the raw user id when the user is not enriched', () => {
    const view = groupSharesByTeam([team()], [share({ user: 'user-8' })], USERS)
    expect(view[0].members[0]).toMatchObject({ email: undefined, name: undefined, userId: 'user-8' })
  })

  it('sorts rows by member name', () => {
    const view = groupSharesByTeam(
      [team()],
      [share({ id: 'tm-2', user: 'user-2' }), share({ id: 'tm-1', user: 'user-1' })],
      USERS
    )
    expect(view[0].members.map((row) => row.name)).toEqual(['Alice', 'Bob'])
  })
})
