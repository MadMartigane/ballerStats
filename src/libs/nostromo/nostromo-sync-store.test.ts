import { createEffect, createRoot } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { storeData } from '../store/store'
import {
  clearBaseline,
  clearUnitDirty,
  clearUnitDirtyIfUnchanged,
  getAllBaselines,
  getBaseline,
  getDirtyRevision,
  getDirtyUnits,
  getNostromoLog,
  getNostromoSyncStatus,
  hydrateNostromoSync,
  isUnitDirty,
  markUnitDirty,
  NOSTROMO_LOG_LIMIT,
  nostromoSync,
  pushNostromoLog,
  resetNostromoSyncData,
  STORAGE_NOSTROMO_BASELINES_KEY,
  STORAGE_NOSTROMO_OUTBOX_KEY,
  setBaseline,
  setBaselines,
  setDirtyUnits,
  setNostromoSyncStatus,
} from './nostromo-sync-store'
import type { NostromoBaseline, NostromoStatus, NostromoSyncPersistedState } from './nostromo-sync-store.d'

/**
 * Tests for the Nostromo sync store. The store is a module singleton, so every
 * test resets it with `hydrateNostromoSync()` (which by design never persists).
 * `storeData` is wrapped instead of stubbed: every test sees both the call count
 * and the real `{ data, lastRecord }` localStorage envelope.
 */
vi.mock('../store/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/store')>()
  return {
    ...actual,
    storeData: vi.fn(actual.storeData),
  }
})

function makeBaseline(overrides: Partial<NostromoBaseline> = {}): NostromoBaseline {
  return {
    docId: 'a1b2c3d4e5f6g7h',
    savedAt: 1_700_000_000_000,
    version: 3,
    ...overrides,
  }
}

function requireBaseline(unit: string): NostromoBaseline {
  const baseline = getBaseline(unit)
  if (!baseline) {
    throw new Error(`Expected a baseline for unit ${unit}`)
  }
  return baseline
}

function readStoredData<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  return raw ? (JSON.parse(raw) as { data: T }).data : null
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  hydrateNostromoSync()
})

describe('nostromo-sync-store hydration', () => {
  it('hydrate() loads baselines and outbox without ever persisting', () => {
    const state: NostromoSyncPersistedState = {
      baselines: { 'photo:player-1': makeBaseline({ docId: 'zzzzzzzzzzzzzzz' }), players: makeBaseline() },
      outbox: ['players', 'teams'],
    }

    hydrateNostromoSync(state)

    expect(getAllBaselines()).toEqual(state.baselines)
    expect(getDirtyUnits()).toEqual(['players', 'teams'])
    expect(storeData).not.toHaveBeenCalled()
  })

  it('hydrate() with no argument resets the store to an empty state', () => {
    setNostromoSyncStatus('saved')
    pushNostromoLog('info', 'hello')
    setBaseline('players', makeBaseline())
    markUnitDirty('players')

    hydrateNostromoSync()

    expect(getNostromoSyncStatus()).toBe('off')
    expect(getNostromoLog()).toEqual([])
    expect(getAllBaselines()).toEqual({})
    expect(getDirtyUnits()).toEqual([])
    // The revisions describe the current session only: a hydration starts a new one.
    expect(getDirtyRevision('players')).toBe(0)
  })

  it('hydrate() clones its input: mutating the raw state never affects the store', () => {
    const rawBaseline = makeBaseline()
    const state: NostromoSyncPersistedState = { baselines: { players: rawBaseline }, outbox: ['players'] }

    hydrateNostromoSync(state)
    rawBaseline.version = 99
    state.outbox.push('teams')

    expect(getBaseline('players')?.version).toBe(3)
    expect(getDirtyUnits()).toEqual(['players'])
  })

  it('hydrates the persisted state on the first read without persisting', async () => {
    const baselines: NostromoSyncPersistedState['baselines'] = { players: makeBaseline({ version: 7 }) }
    const outbox = ['teams']
    const rawBaselines = JSON.stringify({ data: baselines, lastRecord: 1_700_000_000_000 })
    const rawOutbox = JSON.stringify({ data: outbox, lastRecord: 1_700_000_000_000 })
    localStorage.setItem(STORAGE_NOSTROMO_BASELINES_KEY, rawBaselines)
    localStorage.setItem(STORAGE_NOSTROMO_OUTBOX_KEY, rawOutbox)

    vi.resetModules()
    const storeModule = await import('../store/store')
    const freshModule = await import('./nostromo-sync-store')

    expect(freshModule.getAllBaselines()).toEqual(baselines)
    expect(freshModule.getDirtyUnits()).toEqual(outbox)
    // The seeded envelopes are left byte-for-byte untouched: hydration never persists.
    expect(localStorage.getItem(STORAGE_NOSTROMO_BASELINES_KEY)).toBe(rawBaselines)
    expect(localStorage.getItem(STORAGE_NOSTROMO_OUTBOX_KEY)).toBe(rawOutbox)
    expect(storeModule.storeData).not.toHaveBeenCalled()
  })
})

describe('nostromo-sync-store status and log', () => {
  it('transitions through every status without persisting', () => {
    const statuses: NostromoStatus[] = ['off', 'pending', 'saving', 'saved', 'error', 'conflict', 'auth-required']

    expect(getNostromoSyncStatus()).toBe('off')
    for (const status of statuses) {
      setNostromoSyncStatus(status)
      expect(getNostromoSyncStatus()).toBe(status)
    }
    expect(storeData).not.toHaveBeenCalled()
  })

  it('exposes the state reactively so the UI can track status transitions', () => {
    const seen: NostromoStatus[] = []
    const dispose = createRoot((disposeRoot) => {
      createEffect(() => {
        seen.push(nostromoSync.status)
      })
      return disposeRoot
    })

    setNostromoSyncStatus('pending')
    setNostromoSyncStatus('saved')
    dispose()

    expect(seen).toEqual(['off', 'pending', 'saved'])
  })

  it('pushNostromoLog() appends ordered entries and never persists', () => {
    pushNostromoLog('info', 'first')
    pushNostromoLog('warn', 'second')
    pushNostromoLog('error', 'third')

    const log = getNostromoLog()
    expect(log.map((entry) => [entry.level, entry.message])).toEqual([
      ['info', 'first'],
      ['warn', 'second'],
      ['error', 'third'],
    ])
    expect(log.every((entry) => typeof entry.at === 'number')).toBe(true)
    expect(storeData).not.toHaveBeenCalled()
  })

  it('pushNostromoLog() is bounded: past the limit the oldest entries drop first', () => {
    for (let index = 0; index < NOSTROMO_LOG_LIMIT + 10; index += 1) {
      pushNostromoLog('info', `entry-${index}`)
    }

    const log = getNostromoLog()
    expect(log).toHaveLength(NOSTROMO_LOG_LIMIT)
    expect(log[0].message).toBe('entry-10')
    expect(log.at(-1)?.message).toBe(`entry-${NOSTROMO_LOG_LIMIT + 9}`)
  })

  it('getNostromoLog() returns clones: mutating the result never affects the store', () => {
    pushNostromoLog('info', 'first')

    const [entry] = getNostromoLog()
    entry.message = 'mutated'
    entry.level = 'error'

    expect(getNostromoLog()[0].message).toBe('first')
    expect(getNostromoLog()[0].level).toBe('info')
  })
})

describe('nostromo-sync-store baselines', () => {
  it('setBaseline() stores the baseline, makes it retrievable and persists exactly once', () => {
    setBaseline('players', makeBaseline({ version: 2 }))

    expect(getBaseline('players')).toEqual(makeBaseline({ version: 2 }))
    expect(getBaseline('teams')).toBeUndefined()
    expect(storeData).toHaveBeenCalledTimes(1)
    expect(storeData).toHaveBeenCalledWith(STORAGE_NOSTROMO_BASELINES_KEY, { players: makeBaseline({ version: 2 }) })
    expect(readStoredData(STORAGE_NOSTROMO_BASELINES_KEY)).toEqual({ players: makeBaseline({ version: 2 }) })
  })

  it('setBaseline() accepts photo unit keys', () => {
    setBaseline('photo:player-1', makeBaseline({ docId: 'zzzzzzzzzzzzzzz', version: 1 }))

    expect(getBaseline('photo:player-1')).toEqual(makeBaseline({ docId: 'zzzzzzzzzzzzzzz', version: 1 }))
    expect(getAllBaselines()).toEqual({ 'photo:player-1': makeBaseline({ docId: 'zzzzzzzzzzzzzzz', version: 1 }) })
    expect(storeData).toHaveBeenCalledTimes(1)
  })

  it('setBaseline() clones its input and getBaseline() its result: the store is never shared', () => {
    const baseline = makeBaseline()
    setBaseline('players', baseline)

    baseline.version = 99
    expect(getBaseline('players')?.version).toBe(3)

    const retrieved = requireBaseline('players')
    retrieved.version = 42
    expect(getBaseline('players')?.version).toBe(3)
  })

  it('setBaselines() writes every entry in one grouped persist', () => {
    setBaselines([
      { baseline: makeBaseline({ version: 2 }), unit: 'players' },
      { baseline: makeBaseline({ docId: 'b1b2c3d4e5f6g7h', version: 5 }), unit: 'teams' },
      { baseline: makeBaseline({ docId: 'zzzzzzzzzzzzzzz', version: 1 }), unit: 'photo:player-1' },
    ])

    expect(getBaseline('players')).toEqual(makeBaseline({ version: 2 }))
    expect(getBaseline('teams')).toEqual(makeBaseline({ docId: 'b1b2c3d4e5f6g7h', version: 5 }))
    expect(getBaseline('photo:player-1')).toEqual(makeBaseline({ docId: 'zzzzzzzzzzzzzzz', version: 1 }))
    expect(storeData).toHaveBeenCalledTimes(1)
  })

  it('setBaselines() merges into the existing map and clones its inputs', () => {
    setBaseline('clubs', makeBaseline({ docId: 'c1c2c3d4e5f6g7h', version: 7 }))
    const baseline = makeBaseline({ version: 2 })

    setBaselines([{ baseline, unit: 'players' }])
    baseline.version = 99

    expect(getBaseline('clubs')).toEqual(makeBaseline({ docId: 'c1c2c3d4e5f6g7h', version: 7 }))
    expect(getBaseline('players')?.version).toBe(2)
    expect(storeData).toHaveBeenCalledTimes(2)
  })

  it('clearBaseline() forgets a unit and persists once, and is a no-op for an unknown unit', () => {
    setBaseline('players', makeBaseline())
    setBaseline('teams', makeBaseline({ docId: 'b1b2c3d4e5f6g7h' }))
    expect(storeData).toHaveBeenCalledTimes(2)

    clearBaseline('players')

    expect(getBaseline('players')).toBeUndefined()
    expect(getAllBaselines()).toEqual({ teams: makeBaseline({ docId: 'b1b2c3d4e5f6g7h' }) })
    expect(readStoredData(STORAGE_NOSTROMO_BASELINES_KEY)).toEqual({
      teams: makeBaseline({ docId: 'b1b2c3d4e5f6g7h' }),
    })
    expect(storeData).toHaveBeenCalledTimes(3)

    clearBaseline('players')

    expect(storeData).toHaveBeenCalledTimes(3)
  })

  it('getAllBaselines() returns a deep clone: the result never shares state with the store', () => {
    setBaseline('players', makeBaseline())

    const all = getAllBaselines()
    const clonedPlayer = all.players
    if (clonedPlayer) {
      clonedPlayer.docId = 'zzzzzzzzzzzzzzz'
    }
    all.teams = makeBaseline()

    // The mutation really hit the clone, and the store is left untouched.
    expect(all.players?.docId).toBe('zzzzzzzzzzzzzzz')
    expect(getAllBaselines()).toEqual({ players: makeBaseline() })
    expect(getBaseline('teams')).toBeUndefined()
  })

  it('setBaseline() persists the conflict flag and never invents one', () => {
    setBaseline('players', makeBaseline({ conflicted: true }))
    setBaseline('teams', makeBaseline({ docId: 'b1b2c3d4e5f6g7h' }))

    expect(getBaseline('players')?.conflicted).toBe(true)
    expect(getBaseline('teams')?.conflicted).toBeUndefined()
    expect(readStoredData(STORAGE_NOSTROMO_BASELINES_KEY)).toEqual({
      players: makeBaseline({ conflicted: true }),
      teams: makeBaseline({ docId: 'b1b2c3d4e5f6g7h' }),
    })
  })
})

describe('nostromo-sync-store outbox', () => {
  it('markUnitDirty() queues a unit once, keeps push order and persists exactly once', () => {
    markUnitDirty('players')
    markUnitDirty('players')
    markUnitDirty('teams')

    expect(getDirtyUnits()).toEqual(['players', 'teams'])
    expect(isUnitDirty('players')).toBe(true)
    expect(isUnitDirty('matchs')).toBe(false)
    expect(storeData).toHaveBeenCalledTimes(2)
    expect(readStoredData(STORAGE_NOSTROMO_OUTBOX_KEY)).toEqual(['players', 'teams'])
  })

  it('clearUnitDirty() removes a unit and persists once, and is a no-op for an unknown unit', () => {
    markUnitDirty('players')
    markUnitDirty('teams')
    expect(storeData).toHaveBeenCalledTimes(2)

    clearUnitDirty('players')

    expect(getDirtyUnits()).toEqual(['teams'])
    expect(isUnitDirty('players')).toBe(false)
    expect(readStoredData(STORAGE_NOSTROMO_OUTBOX_KEY)).toEqual(['teams'])
    expect(storeData).toHaveBeenCalledTimes(3)

    clearUnitDirty('players')

    expect(storeData).toHaveBeenCalledTimes(3)
  })

  it('setDirtyUnits() replaces the whole outbox, drops duplicates and persists exactly once', () => {
    markUnitDirty('players')

    setDirtyUnits(['teams', 'matchs', 'teams', ''])

    expect(getDirtyUnits()).toEqual(['teams', 'matchs'])
    expect(readStoredData(STORAGE_NOSTROMO_OUTBOX_KEY)).toEqual(['teams', 'matchs'])
    expect(storeData).toHaveBeenCalledTimes(2)
  })

  it('getDirtyUnits() returns a clone: mutating the result never affects the store', () => {
    markUnitDirty('players')

    const units = getDirtyUnits()
    units.push('trombiTitles')

    expect(getDirtyUnits()).toEqual(['players'])
  })

  it('keeps baselines and outbox in separate storage entries', () => {
    setBaseline('players', makeBaseline())
    markUnitDirty('teams')

    expect(storeData).toHaveBeenCalledTimes(2)
    expect(readStoredData(STORAGE_NOSTROMO_BASELINES_KEY)).toEqual({ players: makeBaseline() })
    expect(readStoredData(STORAGE_NOSTROMO_OUTBOX_KEY)).toEqual(['teams'])
  })

  it('markUnitDirty() bumps the revision of an already queued unit without writing again', () => {
    expect(getDirtyRevision('players')).toBe(0)

    markUnitDirty('players')
    markUnitDirty('players')

    expect(getDirtyRevision('players')).toBe(2)
    expect(getDirtyUnits()).toEqual(['players'])
    expect(storeData).toHaveBeenCalledTimes(1)
  })

  it('clearUnitDirtyIfUnchanged() keeps a unit that was marked again since the revision was read', () => {
    markUnitDirty('players')
    const revision = getDirtyRevision('players')

    markUnitDirty('players')

    expect(clearUnitDirtyIfUnchanged('players', revision)).toBe(false)
    expect(getDirtyUnits()).toEqual(['players'])

    expect(clearUnitDirtyIfUnchanged('players', getDirtyRevision('players'))).toBe(true)
    expect(getDirtyUnits()).toEqual([])
  })

  it('clearUnitDirtyIfUnchanged() clears an untouched unit once and never writes twice', () => {
    markUnitDirty('players')
    const revision = getDirtyRevision('players')
    expect(storeData).toHaveBeenCalledTimes(1)

    expect(clearUnitDirtyIfUnchanged('players', revision)).toBe(true)
    expect(readStoredData(STORAGE_NOSTROMO_OUTBOX_KEY)).toEqual([])
    expect(storeData).toHaveBeenCalledTimes(2)

    expect(clearUnitDirtyIfUnchanged('players', revision)).toBe(true)
    expect(storeData).toHaveBeenCalledTimes(2)
  })
})

describe('nostromo-sync-store reset', () => {
  it('resetNostromoSyncData() forgets the baselines, the outbox and the revisions of an account', () => {
    setBaseline('players', makeBaseline())
    setBaseline('photo:player-1', makeBaseline({ conflicted: true, docId: 'zzzzzzzzzzzzzzz' }))
    markUnitDirty('players')
    markUnitDirty('photo:player-1')
    pushNostromoLog('info', 'before the reset')
    vi.mocked(storeData).mockClear()

    resetNostromoSyncData()

    expect(getAllBaselines()).toEqual({})
    expect(getDirtyUnits()).toEqual([])
    expect(getDirtyRevision('players')).toBe(0)
    expect(getNostromoSyncStatus()).toBe('off')
    // The log is the in-memory audit trail of the session: a reset keeps it.
    expect(getNostromoLog().map((entry) => entry.message)).toEqual(['before the reset'])
    // The empty state is persisted: a reload must not bring the account back.
    expect(readStoredData(STORAGE_NOSTROMO_BASELINES_KEY)).toEqual({})
    expect(readStoredData(STORAGE_NOSTROMO_OUTBOX_KEY)).toEqual([])
    expect(storeData).toHaveBeenCalledTimes(2)
  })
})
