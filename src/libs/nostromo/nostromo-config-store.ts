import { createStore } from 'solid-js/store'

import { getStoredDataSync, storeData } from '../store/store'
import type { NostromoConfig } from './nostromo-config-store.d'

export const STORAGE_NOSTROMO_CONFIG_KEY = 'BS_NOSTROMO_CONFIG'

interface NostromoConfigState {
  current: NostromoConfig | undefined
}

const [nostromoConfig, setNostromoConfig] = createStore<NostromoConfigState>({ current: undefined })

export { nostromoConfig }

/**
 * The config is persisted at `BS_NOSTROMO_CONFIG` with the same
 * `{ data, lastRecord }` envelope as the collection stores. It is hydrated
 * lazily on the first read (or explicitly by the boot module through
 * `hydrateNostromoConfig`) so a test can seed localStorage before importing.
 */
let hydrated = false

/**
 * Rebuilds a config from the four contract fields only. Building a fresh object
 * instead of spreading the input guarantees that a stray `password` — or any
 * other extra property — can never reach the store nor localStorage.
 */
function sanitizeConfig(config: NostromoConfig): NostromoConfig {
  return {
    baseUrl: config.baseUrl,
    email: config.email,
    token: config.token,
    userId: config.userId,
  }
}

function loadStoredConfig(): NostromoConfig | undefined {
  const data = getStoredDataSync<NostromoConfig>(STORAGE_NOSTROMO_CONFIG_KEY)?.data
  if (!data) {
    return undefined
  }
  return sanitizeConfig(data)
}

function ensureHydrated(): void {
  if (hydrated) {
    return
  }
  hydrated = true
  setNostromoConfig({ current: loadStoredConfig() })
}

/** Loads a config without EVER persisting. Pass `undefined` to reset the store (tests, sign-out). */
export function hydrateNostromoConfig(config: NostromoConfig | undefined): void {
  hydrated = true
  setNostromoConfig({ current: config ? sanitizeConfig(config) : undefined })
}

function persistConfig(config: NostromoConfig): void {
  storeData(STORAGE_NOSTROMO_CONFIG_KEY, config).catch((error: unknown) => {
    console.error('storeData(Nostromo config) failed:', error)
  })
}

/** Returns a clone of the current config, or undefined when the app is not configured. */
export function getConfig(): NostromoConfig | undefined {
  ensureHydrated()
  const { current } = nostromoConfig
  return current ? sanitizeConfig(current) : undefined
}

/** Replaces the config and persists exactly once: token-only, the password is never stored. */
export function setConfig(config: NostromoConfig): void {
  ensureHydrated()
  const sanitized = sanitizeConfig(config)
  setNostromoConfig({ current: sanitized })
  persistConfig(sanitized)
}

/**
 * Forgets the config in memory and removes its stored entry. `store.ts` exposes
 * no removal helper, so the key is dropped directly instead of leaving an empty
 * envelope behind.
 */
export function clearConfig(): void {
  ensureHydrated()
  setNostromoConfig({ current: undefined })
  localStorage.removeItem(STORAGE_NOSTROMO_CONFIG_KEY)
}

/** Raw token to send as the `Authorization` header value, or undefined when unauthenticated. */
export function getToken(): string | undefined {
  return getConfig()?.token || undefined
}

/**
 * True when the three fields the sync engine needs are present: baseUrl, token
 * and userId. `email` is display only and does not gate synchronization.
 */
export function isConfigured(): boolean {
  const config = getConfig()
  return Boolean(config?.baseUrl && config.token && config.userId)
}

/**
 * Host of the configured backend (`localhost:8090`), or null when the app is not
 * configured (or the stored url is not a parseable http url).
 *
 * Every destructive confirmation names the server its change propagates to, so
 * that the user knows a wipe reaches the backup too. That naming has one source:
 * this function.
 */
export function getNostromoHostName(): string | null {
  const baseUrl = getConfig()?.baseUrl
  if (!baseUrl) {
    return null
  }
  try {
    return new URL(baseUrl).host
  } catch {
    return null
  }
}

/**
 * French ` (host)` reference to the configured server, or an empty string when
 * unconfigured. The destructive confirmations embed it verbatim instead of each
 * branching on the configuration: offline, the reference simply disappears from
 * the sentence.
 */
export function nostromoServerReference(): string {
  const host = getNostromoHostName()
  return host ? ` (${host})` : ''
}
