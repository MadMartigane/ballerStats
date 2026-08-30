import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchLeaseFields } from './lease.d'

const mock = vi.hoisted(() => ({
  pb: {
    collection: vi.fn(),
    send: vi.fn(),
  },
}))

vi.mock('../pocketbase/client', () => ({ pb: mock.pb }))

import {
  acquireMatchLease,
  getLeaseHolderFromError,
  heartbeatMatchLease,
  isLeaseActive,
  isLeaseHeldError,
  leaseStateForMe,
  releaseMatchLease,
} from './lease'

describe('isLeaseActive', () => {
  it('is false when there is no deadline', () => {
    expect(isLeaseActive(null, 1000)).toBe(false)
  })

  it('is true when the deadline is in the future', () => {
    expect(isLeaseActive(new Date(2000).toISOString(), 1000)).toBe(true)
  })

  it('is false when the deadline is in the past', () => {
    expect(isLeaseActive(new Date(1000).toISOString(), 2000)).toBe(false)
  })

  it('is expired exactly at the deadline (active requires strictly after)', () => {
    const deadline = new Date(5000).toISOString()
    expect(isLeaseActive(deadline, 5000)).toBe(false)
  })
})

describe('leaseStateForMe', () => {
  const now = 10_000
  const activeDeadline = new Date(now + 30_000).toISOString()
  const expiredDeadline = new Date(now - 1).toISOString()

  it("is 'free' when no scorer holds the lease", () => {
    const record: MatchLeaseFields = { scorer: null, scorerLockUntil: null }
    expect(leaseStateForMe(record, 'me', now)).toBe('free')
  })

  it("is 'mine' when I hold an active lease", () => {
    const record: MatchLeaseFields = { scorer: 'me', scorerLockUntil: activeDeadline }
    expect(leaseStateForMe(record, 'me', now)).toBe('mine')
  })

  it("is 'taken-by-other' when another user holds an active lease", () => {
    const record: MatchLeaseFields = { scorer: 'other', scorerLockUntil: activeDeadline }
    expect(leaseStateForMe(record, 'me', now)).toBe('taken-by-other')
  })

  it("is 'expired' when my own lease has lapsed", () => {
    const record: MatchLeaseFields = { scorer: 'me', scorerLockUntil: expiredDeadline }
    expect(leaseStateForMe(record, 'me', now)).toBe('expired')
  })

  it("is 'expired' when another holder's lease has lapsed", () => {
    const record: MatchLeaseFields = { scorer: 'other', scorerLockUntil: expiredDeadline }
    expect(leaseStateForMe(record, 'me', now)).toBe('expired')
  })

  it("is 'expired' when the scorer is set without a deadline", () => {
    const record: MatchLeaseFields = { scorer: 'other', scorerLockUntil: null }
    expect(leaseStateForMe(record, 'me', now)).toBe('expired')
  })
})

describe('lease API calls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mock.pb.send).mockResolvedValue({
      expiresInSeconds: 45,
      scorer: 'user-1',
      scorerLockUntil: new Date().toISOString(),
    })
  })

  it('acquires without force by default', async () => {
    await acquireMatchLease('match-1')
    expect(mock.pb.send).toHaveBeenCalledWith('/api/baller/matchs/match-1/acquire', {
      body: { force: false },
      method: 'POST',
    })
  })

  it('passes force through when requested', async () => {
    await acquireMatchLease('match-1', { force: true })
    expect(mock.pb.send).toHaveBeenCalledWith('/api/baller/matchs/match-1/acquire', {
      body: { force: true },
      method: 'POST',
    })
  })

  it('heartbeat renews through the acquire route', async () => {
    await heartbeatMatchLease('match-1')
    expect(mock.pb.send).toHaveBeenCalledWith('/api/baller/matchs/match-1/acquire', {
      body: { force: false },
      method: 'POST',
    })
  })

  it('releases through the release route', async () => {
    await releaseMatchLease('match-1')
    expect(mock.pb.send).toHaveBeenCalledWith('/api/baller/matchs/match-1/release', { method: 'POST' })
  })
})

describe('lease error decoding', () => {
  it('detects the 409 holder rejection only', () => {
    expect(isLeaseHeldError({ status: 409 })).toBe(true)
    expect(isLeaseHeldError({ status: 500 })).toBe(false)
    expect(isLeaseHeldError(new Error('network down'))).toBe(false)
  })

  it('reads the holder from the nested PocketBase error body', () => {
    const err = { data: { data: { holder: { email: 'a@b.c', id: 'u-2', name: 'Alice' } } }, status: 409 }
    expect(getLeaseHolderFromError(err)).toEqual({ email: 'a@b.c', id: 'u-2', name: 'Alice' })
  })

  it('falls back to a top-level holder', () => {
    const err = { data: { holder: { id: 'u-2', name: 'Alice' } }, status: 409 }
    expect(getLeaseHolderFromError(err)).toEqual({ id: 'u-2', name: 'Alice' })
  })

  it('returns null when no holder is present', () => {
    expect(getLeaseHolderFromError({ message: 'held', status: 409 })).toBeNull()
    expect(getLeaseHolderFromError(undefined)).toBeNull()
  })
})
