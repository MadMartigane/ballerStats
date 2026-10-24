import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NostromoBaseline, NostromoBaselines } from './nostromo-sync-store.d'

/**
 * Tests of the sync boot. The module is a singleton with a `booted` guard, so
 * every test imports a fresh copy: `vi.resetModules()` then one dynamic import
 * per module of the graph, all from the same generation. The sync store is the
 * real one (the point of the boot is what it reads and derives); only the engine
 * retries and the configuration are mocked.
 */
vi.mock('./auto-sync', () => ({ startNostromoAutoSync: vi.fn(), stopNostromoAutoSync: vi.fn() }))

vi.mock('./nostromo-config-store', () => ({
  getConfig: vi.fn(() => undefined),
  isConfigured: vi.fn(() => false),
}))

vi.mock('./conflict-resolution', () => ({ resolveConflict: vi.fn(() => Promise.resolve()) }))
vi.mock('./push-engine', () => ({ flushNostromoPush: vi.fn(() => Promise.resolve()) }))
vi.mock('./pull-engine', () => ({ pullNostromo: vi.fn(() => Promise.resolve({ kind: 'up-to-date' })) }))
vi.mock('./auth-session', () => ({ ensureFreshSession: vi.fn(() => Promise.resolve('fresh')) }))
vi.mock('../utils/utils', () => ({ toast: vi.fn() }))

const OUTBOX_KEY = 'BS_NOSTROMO_OUTBOX'
const BASELINES_KEY = 'BS_NOSTROMO_BASELINES'

interface BootHarness {
  boot: typeof import('./sync-boot')
  isConfigured: ReturnType<typeof vi.mocked<typeof import('./nostromo-config-store').isConfigured>>
  pullNostromo: ReturnType<typeof vi.mocked<typeof import('./pull-engine').pullNostromo>>
  startNostromoAutoSync: ReturnType<typeof vi.mocked<typeof import('./auto-sync').startNostromoAutoSync>>
  store: typeof import('./nostromo-sync-store')
  toast: ReturnType<typeof vi.mocked<typeof import('../utils/utils').toast>>
}

/** A fresh boot module, with the fresh copies of the modules it reads. */
async function bootHarness(): Promise<BootHarness> {
  vi.resetModules()
  return {
    boot: await import('./sync-boot'),
    isConfigured: vi.mocked((await import('./nostromo-config-store')).isConfigured),
    pullNostromo: vi.mocked((await import('./pull-engine')).pullNostromo),
    startNostromoAutoSync: vi.mocked((await import('./auto-sync')).startNostromoAutoSync),
    store: await import('./nostromo-sync-store'),
    toast: vi.mocked((await import('../utils/utils')).toast),
  }
}

function makeBaseline(overrides: Partial<NostromoBaseline> = {}): NostromoBaseline {
  return { docId: 'pl0000000000001', savedAt: 1_700_000_000_000, version: 3, ...overrides }
}

/** Seeds the persisted sync state exactly like the store writes it. */
function seedPersistedState(outbox: string[], baselines: NostromoBaselines = {}): void {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify({ data: outbox, lastRecord: 1 }))
  localStorage.setItem(BASELINES_KEY, JSON.stringify({ data: baselines, lastRecord: 1 }))
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('startNostromoSyncBoot', () => {
  it('starts off when no backend is configured, and still installs the retries', async () => {
    const { boot, isConfigured, startNostromoAutoSync, store } = await bootHarness()
    isConfigured.mockReturnValue(false)
    seedPersistedState(['players'])

    boot.startNostromoSyncBoot()

    expect(store.getNostromoSyncStatus()).toBe('off')
    expect(startNostromoAutoSync).toHaveBeenCalledTimes(1)
    // The queued unit is kept: it will be pushed after a sign-in.
    expect(store.getDirtyUnits()).toEqual(['players'])
  })

  it('starts pending when configured with units queued before the reload', async () => {
    const { boot, isConfigured, store } = await bootHarness()
    isConfigured.mockReturnValue(true)
    seedPersistedState(['players', 'teams'])

    boot.startNostromoSyncBoot()

    expect(store.getNostromoSyncStatus()).toBe('pending')
    expect(store.getNostromoLog().at(-1)?.message).toContain('2')
  })

  it('starts saved when configured with an empty outbox', async () => {
    const { boot, isConfigured, store } = await bootHarness()
    isConfigured.mockReturnValue(true)
    seedPersistedState([])

    boot.startNostromoSyncBoot()

    expect(store.getNostromoSyncStatus()).toBe('saved')
    expect(store.getNostromoLog()).toEqual([])
  })

  it('starts in conflict when a unit was parked before the reload', async () => {
    const { boot, isConfigured, store } = await bootHarness()
    isConfigured.mockReturnValue(true)
    seedPersistedState(['players'], { players: makeBaseline({ conflicted: true }) })

    boot.startNostromoSyncBoot()

    expect(store.getNostromoSyncStatus()).toBe('conflict')
    // The parking is read back from the persisted baseline, not from memory.
    expect(store.getConflictedUnits()).toEqual(['players'])
  })

  it('reads the persisted state without ever writing it back', async () => {
    const { boot, isConfigured, store } = await bootHarness()
    isConfigured.mockReturnValue(true)
    const baselines = { players: makeBaseline() }
    seedPersistedState(['players'], baselines)
    const rawBaselines = localStorage.getItem(BASELINES_KEY)

    boot.startNostromoSyncBoot()

    expect(store.getAllBaselines()).toEqual(baselines)
    expect(localStorage.getItem(BASELINES_KEY)).toBe(rawBaselines)
  })

  it('boots once: a second call neither restarts the retries nor resets the status', async () => {
    const { boot, isConfigured, startNostromoAutoSync, store } = await bootHarness()
    isConfigured.mockReturnValue(true)

    boot.startNostromoSyncBoot()
    expect(store.getNostromoSyncStatus()).toBe('saved')

    store.setNostromoSyncStatus('auth-required')
    boot.startNostromoSyncBoot()

    expect(startNostromoAutoSync).toHaveBeenCalledTimes(1)
    expect(store.getNostromoSyncStatus()).toBe('auth-required')
  })
})

describe('pull on open', () => {
  it('pulls silently when nothing is applied', async () => {
    const { boot, isConfigured, pullNostromo, toast } = await bootHarness()
    isConfigured.mockReturnValue(true)

    boot.startNostromoSyncBoot()
    await vi.waitFor(() => expect(pullNostromo).toHaveBeenCalledTimes(1))

    expect(toast).not.toHaveBeenCalled()
    expect(boot.openPullDecision()).toBeUndefined()
  })

  it('toasts when units were applied', async () => {
    const { boot, isConfigured, pullNostromo, toast } = await bootHarness()
    isConfigured.mockReturnValue(true)
    pullNostromo.mockResolvedValueOnce({ kind: 'applied', units: ['players'] })

    boot.startNostromoSyncBoot()

    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith('Données mises à jour depuis le serveur.', 'success'))
  })

  it('exposes a decision when unsynced data remains, and applies nothing', async () => {
    const { boot, isConfigured, pullNostromo, toast } = await bootHarness()
    isConfigured.mockReturnValue(true)
    seedPersistedState(['players'])
    pullNostromo.mockResolvedValueOnce({ kind: 'skipped', reason: 'conflict-pending' })

    boot.startNostromoSyncBoot()

    await vi.waitFor(() => expect(boot.openPullDecision()).toEqual({ units: ['players'] }))
    expect(toast).not.toHaveBeenCalled()
  })

  it('shows no modal and no toast when opened offline', async () => {
    const { boot, isConfigured, pullNostromo, toast } = await bootHarness()
    isConfigured.mockReturnValue(true)
    seedPersistedState(['players'])
    pullNostromo.mockResolvedValueOnce({ kind: 'skipped', reason: 'conflict-pending' })
    const onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    boot.startNostromoSyncBoot()
    await vi.waitFor(() => expect(pullNostromo).toHaveBeenCalledTimes(1))
    await Promise.resolve()

    expect(boot.openPullDecision()).toBeUndefined()
    expect(toast).not.toHaveBeenCalled()
    onLineSpy.mockRestore()
  })

  it('takes only collection units from the server, and leaves a photo queued', async () => {
    const { boot, isConfigured, pullNostromo } = await bootHarness()
    isConfigured.mockReturnValue(true)
    seedPersistedState(['players', 'photo:p1'], { players: { docId: 'd-players', savedAt: 1, version: 1 } })
    pullNostromo.mockResolvedValueOnce({ kind: 'skipped', reason: 'conflict-pending' })
    boot.startNostromoSyncBoot()
    await vi.waitFor(() => expect(boot.openPullDecision()).toEqual({ units: ['players', 'photo:p1'] }))
    const { resolveConflict } = await import('./conflict-resolution')

    await boot.takeServerOnOpenPull()

    expect(vi.mocked(resolveConflict).mock.calls).toEqual([['players', 'take-server']])
  })

  it('keeps taking the next unit when one unit fails, and reports it', async () => {
    const { boot, isConfigured, pullNostromo, toast } = await bootHarness()
    isConfigured.mockReturnValue(true)
    seedPersistedState(['clubs', 'players'], {
      clubs: { docId: 'd-clubs', savedAt: 1, version: 1 },
      players: { docId: 'd-players', savedAt: 1, version: 1 },
    })
    pullNostromo.mockResolvedValueOnce({ kind: 'skipped', reason: 'conflict-pending' })
    boot.startNostromoSyncBoot()
    await vi.waitFor(() => expect(boot.openPullDecision()).toEqual({ units: ['clubs', 'players'] }))
    const { resolveConflict } = await import('./conflict-resolution')
    vi.mocked(resolveConflict).mockRejectedValueOnce(new Error('boom'))

    await boot.takeServerOnOpenPull()

    expect(vi.mocked(resolveConflict).mock.calls).toEqual([
      ['clubs', 'take-server'],
      ['players', 'take-server'],
    ])
    expect(toast).toHaveBeenCalledWith('boom', 'error')
    expect(boot.openPullDecision()).toBeUndefined()
  })

  it('keeps the modal busy while a handler runs, then releases it', async () => {
    const { boot, isConfigured, pullNostromo } = await bootHarness()
    isConfigured.mockReturnValue(true)
    seedPersistedState(['clubs'], { clubs: { docId: 'd-clubs', savedAt: 1, version: 1 } })
    pullNostromo.mockResolvedValueOnce({ kind: 'skipped', reason: 'conflict-pending' })
    boot.startNostromoSyncBoot()
    await vi.waitFor(() => expect(boot.openPullDecision()).toBeDefined())
    const { resolveConflict } = await import('./conflict-resolution')
    let release: () => void = () => undefined
    vi.mocked(resolveConflict).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )

    const pending = boot.takeServerOnOpenPull()
    expect(boot.openPullBusy()).toBe(true)
    // Mid-flight: the modal keeps its decision while the handler runs. A finally that cleared
    // the decision before the work ended would unmount the modal here.
    expect(boot.openPullDecision()).toBeDefined()
    release()
    await pending

    expect(boot.openPullBusy()).toBe(false)
    expect(boot.openPullDecision()).toBeUndefined()
  })

  it('keeps the decision set by a retry: the finally clears only the decision its own call owned', async () => {
    const { boot, isConfigured, pullNostromo } = await bootHarness()
    isConfigured.mockReturnValue(true)
    seedPersistedState(['players'])
    pullNostromo.mockResolvedValueOnce({ kind: 'skipped', reason: 'conflict-pending' })
    boot.startNostromoSyncBoot()
    await vi.waitFor(() => expect(boot.openPullDecision()).toEqual({ units: ['players'] }))
    // The retry's pull still finds unsynced data: the decision it sets must survive the handler.
    pullNostromo.mockResolvedValueOnce({ kind: 'skipped', reason: 'conflict-pending' })

    await boot.retryOpenPull()

    expect(boot.openPullBusy()).toBe(false)
    expect(boot.openPullDecision()).toEqual({ units: ['players'] })
  })

  it('does not pull when unconfigured, nor twice', async () => {
    const { boot, isConfigured, pullNostromo } = await bootHarness()
    isConfigured.mockReturnValue(false)
    boot.startNostromoSyncBoot()
    expect(pullNostromo).not.toHaveBeenCalled()

    isConfigured.mockReturnValue(true)
    boot.startNostromoSyncBoot()
    expect(pullNostromo).not.toHaveBeenCalled()
  })
})
