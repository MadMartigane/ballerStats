import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PULL_MIN_INTERVAL_MS, startNostromoAutoSync, stopNostromoAutoSync } from './auto-sync'
import { isConfigured } from './nostromo-config-store'
import { getDirtyUnits, getNostromoSyncStatus } from './nostromo-sync-store'
import { pullNostromo } from './pull-engine'
import { flushNostromoPush, isPushBackoffActive, launchFlush, NOSTROMO_RETRY_INTERVAL_MS } from './push-engine'

vi.mock('./nostromo-config-store', () => ({ isConfigured: vi.fn(() => true) }))
vi.mock('./nostromo-sync-store', () => ({
  getDirtyUnits: vi.fn(() => ['players']),
  getNostromoSyncStatus: vi.fn(() => 'saved'),
  pushNostromoLog: vi.fn(),
}))
vi.mock('./pull-engine', () => ({ pullNostromo: vi.fn(() => Promise.resolve({ kind: 'up-to-date' })) }))
vi.mock('./push-engine', () => ({
  flushNostromoPush: vi.fn(() => Promise.resolve()),
  isPushBackoffActive: vi.fn(() => false),
  launchFlush: vi.fn(),
  NOSTROMO_RETRY_INTERVAL_MS: 60_000,
}))

function setVisibility(state: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T10:00:00Z'))
  vi.clearAllMocks()
  vi.mocked(isConfigured).mockReturnValue(true)
  vi.mocked(getDirtyUnits).mockReturnValue(['players'])
  vi.mocked(getNostromoSyncStatus).mockReturnValue('saved')
  vi.mocked(isPushBackoffActive).mockReturnValue(false)
})

afterEach(() => {
  stopNostromoAutoSync()
  vi.useRealTimers()
})

describe('auto-sync', () => {
  it('flushes on the interval, and only once however many times it is started', () => {
    startNostromoAutoSync()
    startNostromoAutoSync()

    vi.advanceTimersByTime(NOSTROMO_RETRY_INTERVAL_MS)

    expect(launchFlush).toHaveBeenCalledTimes(1)
  })

  it('skips the interval flush during a backoff, with nothing pending or without backend', () => {
    startNostromoAutoSync()
    vi.mocked(isPushBackoffActive).mockReturnValue(true)
    vi.advanceTimersByTime(NOSTROMO_RETRY_INTERVAL_MS)
    vi.mocked(isPushBackoffActive).mockReturnValue(false)
    vi.mocked(getDirtyUnits).mockReturnValue([])
    vi.advanceTimersByTime(NOSTROMO_RETRY_INTERVAL_MS)
    vi.mocked(getDirtyUnits).mockReturnValue(['players'])
    vi.mocked(isConfigured).mockReturnValue(false)
    vi.advanceTimersByTime(NOSTROMO_RETRY_INTERVAL_MS)

    expect(launchFlush).not.toHaveBeenCalled()
  })

  it('flushes when the tab is hidden and pulls, throttled, when it is visible', () => {
    startNostromoAutoSync()

    setVisibility('hidden')
    expect(launchFlush).toHaveBeenCalledTimes(1)

    setVisibility('visible')
    setVisibility('visible')
    expect(pullNostromo).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(PULL_MIN_INTERVAL_MS)
    setVisibility('visible')
    expect(pullNostromo).toHaveBeenCalledTimes(2)
  })

  it('does not pull on an expired session or a parked conflict', () => {
    startNostromoAutoSync()
    vi.mocked(getNostromoSyncStatus).mockReturnValue('auth-required')
    setVisibility('visible')
    vi.mocked(getNostromoSyncStatus).mockReturnValue('conflict')
    setVisibility('visible')

    expect(pullNostromo).not.toHaveBeenCalled()
  })

  it('flushes then pulls on online, ignoring the backoff and the throttle', async () => {
    startNostromoAutoSync()
    vi.mocked(isPushBackoffActive).mockReturnValue(true)

    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)

    expect(flushNostromoPush).toHaveBeenCalledTimes(1)
    expect(pullNostromo).toHaveBeenCalledTimes(1)
  })

  it('removes every trigger when stopped', () => {
    startNostromoAutoSync()
    stopNostromoAutoSync()

    vi.advanceTimersByTime(NOSTROMO_RETRY_INTERVAL_MS)
    setVisibility('hidden')
    window.dispatchEvent(new Event('online'))

    expect(launchFlush).not.toHaveBeenCalled()
    expect(flushNostromoPush).not.toHaveBeenCalled()
  })
})
