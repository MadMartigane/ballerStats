import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NostromoBaseline, NostromoBaselines } from './nostromo-sync-store.d'

/**
 * Tests of the sync boot. The module is a singleton with a `booted` guard, so
 * every test imports a fresh copy: `vi.resetModules()` then one dynamic import
 * per module of the graph, all from the same generation. The sync store is the
 * real one (the point of the boot is what it reads and derives); only the engine
 * retries and the configuration are mocked.
 */
vi.mock('./push-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./push-engine')>()),
  startNostromoAutoSync: vi.fn(),
}))

vi.mock('./nostromo-config-store', () => ({
  getConfig: vi.fn(() => undefined),
  isConfigured: vi.fn(() => false),
}))

const OUTBOX_KEY = 'BS_NOSTROMO_OUTBOX'
const BASELINES_KEY = 'BS_NOSTROMO_BASELINES'

interface BootHarness {
  boot: typeof import('./sync-boot')
  isConfigured: ReturnType<typeof vi.mocked<typeof import('./nostromo-config-store').isConfigured>>
  startNostromoAutoSync: ReturnType<typeof vi.mocked<typeof import('./push-engine').startNostromoAutoSync>>
  store: typeof import('./nostromo-sync-store')
}

/** A fresh boot module, with the fresh copies of the modules it reads. */
async function bootHarness(): Promise<BootHarness> {
  vi.resetModules()
  return {
    boot: await import('./sync-boot'),
    isConfigured: vi.mocked((await import('./nostromo-config-store')).isConfigured),
    startNostromoAutoSync: vi.mocked((await import('./push-engine')).startNostromoAutoSync),
    store: await import('./nostromo-sync-store'),
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
