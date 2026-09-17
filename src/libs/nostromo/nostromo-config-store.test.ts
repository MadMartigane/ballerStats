import { beforeEach, describe, expect, it, vi } from 'vitest'

import { storeData } from '../store/store'
import {
  clearConfig,
  getConfig,
  getToken,
  hydrateNostromoConfig,
  isConfigured,
  STORAGE_NOSTROMO_CONFIG_KEY,
  setConfig,
} from './nostromo-config-store'
import type { NostromoConfig } from './nostromo-config-store.d'

/**
 * Tests for the Nostromo config store. The store is a module singleton, so
 * every test resets it with `hydrateNostromoConfig(undefined)` (which by design
 * never persists). `storeData` is wrapped instead of stubbed: every test sees
 * both the call count and the real `{ data, lastRecord }` localStorage envelope.
 */
vi.mock('../store/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/store')>()
  return {
    ...actual,
    storeData: vi.fn(actual.storeData),
  }
})

function makeConfig(overrides: Partial<NostromoConfig> = {}): NostromoConfig {
  return {
    baseUrl: 'https://nostromo.example.com',
    email: 'player@example.com',
    token: 'token-1',
    userId: 'user-1',
    ...overrides,
  }
}

function readStoredEnvelope(): { data: NostromoConfig; lastRecord: number } | null {
  const raw = localStorage.getItem(STORAGE_NOSTROMO_CONFIG_KEY)
  return raw ? JSON.parse(raw) : null
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  hydrateNostromoConfig(undefined)
})

describe('nostromo-config-store', () => {
  it('starts empty and never persists on a plain read', () => {
    expect(getConfig()).toBeUndefined()
    expect(getToken()).toBeUndefined()
    expect(isConfigured()).toBe(false)
    expect(storeData).not.toHaveBeenCalled()
  })

  it('setConfig() persists the config exactly once in the { data, lastRecord } envelope', () => {
    setConfig(makeConfig())

    expect(storeData).toHaveBeenCalledTimes(1)
    const envelope = readStoredEnvelope()
    expect(envelope?.data).toEqual(makeConfig())
    expect(typeof envelope?.lastRecord).toBe('number')
  })

  it('setConfig() never stores a password or any property outside the contract', () => {
    const withPassword = { ...makeConfig(), password: 'hunter2' }

    setConfig(withPassword as NostromoConfig)

    const envelope = readStoredEnvelope()
    expect(Object.keys(envelope?.data ?? {})).toEqual(['baseUrl', 'email', 'token', 'userId'])
    expect(envelope?.data).toEqual(makeConfig())
    expect(localStorage.getItem(STORAGE_NOSTROMO_CONFIG_KEY)).not.toContain('hunter2')
    expect(getConfig()).toEqual(makeConfig())
  })

  it('setConfig() clones its input: mutating the argument afterwards never affects the store', () => {
    const config = makeConfig()
    setConfig(config)

    config.token = 'mutated'
    config.baseUrl = 'https://mutated.example.com'

    expect(getToken()).toBe('token-1')
    expect(getConfig()?.baseUrl).toBe('https://nostromo.example.com')
  })

  it('getConfig() returns a clone: mutating the result never affects the store', () => {
    setConfig(makeConfig())

    const retrieved = getConfig()
    if (retrieved) {
      retrieved.token = 'mutated'
      retrieved.email = 'mutated@example.com'
    }

    expect(getToken()).toBe('token-1')
    expect(getConfig()?.email).toBe('player@example.com')
  })

  it('getToken() and isConfigured() require the sync fields, not the display email', () => {
    setConfig(makeConfig())
    expect(isConfigured()).toBe(true)
    expect(getToken()).toBe('token-1')

    hydrateNostromoConfig(makeConfig({ token: '' }))
    expect(getToken()).toBeUndefined()
    expect(isConfigured()).toBe(false)

    hydrateNostromoConfig(makeConfig({ email: '' }))
    expect(isConfigured()).toBe(true)

    hydrateNostromoConfig(makeConfig({ userId: '' }))
    expect(isConfigured()).toBe(false)

    hydrateNostromoConfig(makeConfig({ baseUrl: '' }))
    expect(isConfigured()).toBe(false)
  })

  it('hydrateNostromoConfig() keeps the four contract fields only and never persists', () => {
    const withExtra = { ...makeConfig(), password: 'hunter2' }

    hydrateNostromoConfig(withExtra as NostromoConfig)

    expect(getConfig()).toEqual(makeConfig())
    expect(storeData).not.toHaveBeenCalled()
  })

  it('clearConfig() drops the config from memory and from localStorage without writing again', () => {
    setConfig(makeConfig())
    expect(storeData).toHaveBeenCalledTimes(1)

    clearConfig()

    expect(getConfig()).toBeUndefined()
    expect(isConfigured()).toBe(false)
    expect(localStorage.getItem(STORAGE_NOSTROMO_CONFIG_KEY)).toBeNull()
    expect(storeData).toHaveBeenCalledTimes(1)
  })

  it('hydrates the config from localStorage on the first read without persisting', async () => {
    const seeded = makeConfig({ token: 'seeded-token' })
    const raw = JSON.stringify({ data: seeded, lastRecord: 1_700_000_000_000 })
    localStorage.setItem(STORAGE_NOSTROMO_CONFIG_KEY, raw)

    vi.resetModules()
    const storeModule = await import('../store/store')
    const freshModule = await import('./nostromo-config-store')

    expect(freshModule.getConfig()).toEqual(seeded)
    expect(freshModule.getToken()).toBe('seeded-token')
    // The seeded envelope is left byte-for-byte untouched: hydration never persists.
    expect(localStorage.getItem(STORAGE_NOSTROMO_CONFIG_KEY)).toBe(raw)
    expect(storeModule.storeData).not.toHaveBeenCalled()
  })
})
