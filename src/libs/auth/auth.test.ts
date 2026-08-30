import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClubMembersRecord } from './auth.d'

const mock = vi.hoisted(() => {
  const authStore = {
    clear: vi.fn(),
    isValid: false,
    model: null as unknown,
    onChange: vi.fn(() => () => undefined),
  }
  return {
    authStore,
    pb: {
      authStore,
      collection: vi.fn(),
      filter: (raw: string) => raw,
    },
  }
})

vi.mock('../pocketbase/client', () => ({ isAuthEnabled: true, pb: mock.pb }))

import {
  authError,
  authLoading,
  canManageStaff,
  currentClub,
  currentRole,
  currentUser,
  initAuth,
  loadClubMembership,
  login,
  logout,
  resolveMembership,
} from './auth'

function membershipItem(overrides: Partial<ClubMembersRecord> = {}): ClubMembersRecord {
  return {
    club: 'club-1',
    collectionId: 'pbc_members',
    collectionName: 'club_members',
    created: '',
    expand: {
      club: {
        club: 'club-1',
        collectionId: 'pbc_clubs',
        collectionName: 'clubs',
        created: '',
        id: 'club-1',
        name: 'Dev Club',
        owner: 'user-1',
        updated: '',
      },
    },
    id: 'membership-1',
    role: 'owner',
    updated: '',
    user: 'user-1',
    ...overrides,
  } as unknown as ClubMembersRecord
}

describe('resolveMembership', () => {
  it('returns null when there is no membership', () => {
    expect(resolveMembership([])).toBeNull()
  })

  it('extracts the first membership club and role', () => {
    expect(resolveMembership([membershipItem()])).toEqual({
      club: { id: 'club-1', name: 'Dev Club' },
      role: 'owner',
    })
  })

  it('picks the first item when there are several memberships', () => {
    const admin = membershipItem({ id: 'membership-2', role: 'admin' })
    expect(resolveMembership([membershipItem(), admin])?.role).toBe('owner')
  })

  it('returns null when the expanded club is missing', () => {
    const item = membershipItem()
    item.expand = {}
    expect(resolveMembership([item])).toBeNull()
  })
})

describe('canManageStaff', () => {
  it('is true only for owner and admin', () => {
    expect(canManageStaff('owner')).toBe(true)
    expect(canManageStaff('admin')).toBe(true)
    expect(canManageStaff('staff')).toBe(false)
    expect(canManageStaff(null)).toBe(false)
  })
})

describe('login / logout', () => {
  beforeEach(() => {
    mock.authStore.isValid = false
    mock.authStore.model = null
    logout()
    vi.clearAllMocks()
    vi.mocked(mock.pb.collection).mockImplementation(() => ({
      authWithPassword: vi.fn().mockResolvedValue({}),
      getList: vi.fn(),
    }))
  })

  it('stores the user and the first club membership after login', async () => {
    mock.authStore.isValid = true
    mock.authStore.model = { collectionName: 'users', email: 'owner@baller.local', id: 'user-1', name: 'Dev Owner' }
    vi.mocked(mock.pb.collection).mockImplementation((name: string) =>
      name === 'users'
        ? { authWithPassword: vi.fn().mockResolvedValue({}) }
        : { getList: vi.fn().mockResolvedValue({ items: [membershipItem()], totalItems: 1 }) }
    )

    await login('owner@baller.local', 'DevDevDev1!')

    expect(mock.pb.collection).toHaveBeenCalledWith('users')
    expect(mock.pb.collection).toHaveBeenCalledWith('club_members')
    expect(currentUser.get()).toEqual({ email: 'owner@baller.local', id: 'user-1', name: 'Dev Owner' })
    expect(currentClub.get()).toEqual({ id: 'club-1', name: 'Dev Club' })
    expect(currentRole.get()).toBe('owner')
    expect(authLoading.get()).toBe(false)
  })

  it('sets authError and keeps the session empty on failed login', async () => {
    vi.mocked(mock.pb.collection).mockImplementation(() => ({
      authWithPassword: vi.fn().mockRejectedValue(new Error('Failed to authenticate.')),
      getList: vi.fn(),
    }))

    await expect(login('a@b.c', 'wrong')).rejects.toThrow('Failed to authenticate.')
    expect(authError.get()).toBe('Failed to authenticate.')
    expect(currentUser.get()).toBeNull()
    expect(currentClub.get()).toBeNull()
    expect(currentRole.get()).toBeNull()
    expect(authLoading.get()).toBe(false)
  })

  it('clears the session state on logout', () => {
    currentUser.set({ email: 'a@b.c', id: 'user-1', name: 'A' })
    currentRole.set('admin')

    logout()

    expect(mock.pb.authStore.clear).toHaveBeenCalled()
    expect(currentUser.get()).toBeNull()
    expect(currentClub.get()).toBeNull()
    expect(currentRole.get()).toBeNull()
  })

  it('loadClubMembership resets the session when the token is invalid', async () => {
    await loadClubMembership()
    expect(currentUser.get()).toBeNull()
    expect(currentClub.get()).toBeNull()
  })

  it('registers the auth store listener once and skips loading without a session', () => {
    initAuth()
    initAuth()
    expect(mock.pb.authStore.onChange).toHaveBeenCalledTimes(1)
    expect(currentUser.get()).toBeNull()
  })
})
