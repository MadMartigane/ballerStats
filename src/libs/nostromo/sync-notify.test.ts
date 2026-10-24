import { beforeEach, describe, expect, it, vi } from 'vitest'

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }))
vi.mock('../utils/utils', () => ({ toast: toastMock }))

import { NOTIFY_DEDUPE_MS, notifySyncFailure, notifySyncFailureStatus, resetSyncNotifyForTests } from './sync-notify'

describe('notifySyncFailure', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    resetSyncNotifyForTests()
  })

  it('toasts once for ten identical failures', () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      notifySyncFailure('error')
      vi.advanceTimersByTime(20_000)
    }
    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(toastMock.mock.calls[0][0]).toContain('La synchronisation a échoué.')
  })

  it('toasts again after the dedupe window', () => {
    notifySyncFailure('auth')
    vi.advanceTimersByTime(NOTIFY_DEDUPE_MS)
    notifySyncFailure('auth')
    expect(toastMock).toHaveBeenCalledTimes(2)
  })

  it('dedupes each kind independently', () => {
    notifySyncFailure('auth')
    notifySyncFailure('conflict')
    expect(toastMock).toHaveBeenCalledTimes(2)
  })

  it('maps failure statuses and ignores the others', () => {
    notifySyncFailureStatus('saved')
    notifySyncFailureStatus('pending')
    expect(toastMock).not.toHaveBeenCalled()
    notifySyncFailureStatus('auth-required')
    expect(toastMock.mock.calls[0][0]).toBe('Session expirée : reconnectez-vous à Nostromo.')
  })
})
