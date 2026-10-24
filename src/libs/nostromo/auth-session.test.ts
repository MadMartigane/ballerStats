import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureFreshSession, readJwtExpiry, SESSION_REFRESH_MARGIN_MS } from './auth-session'
import { getConfig, hydrateNostromoConfig } from './nostromo-config-store'
import type { NostromoConfig } from './nostromo-config-store.d'
import { getNostromoLog, getNostromoSyncStatus, hydrateNostromoSync } from './nostromo-sync-store'

const fetchMock = vi.fn()
const BASE64URL_UNSAFE = /[+/=]/g
const BASE64URL_REPLACEMENTS: Record<string, string> = { '/': '_', '+': '-', '=': '' }

function encodeBase64UrlChar(character: string): string {
  return BASE64URL_REPLACEMENTS[character] ?? character
}
const NOW = Date.UTC(2026, 9, 24, 12, 0, 0)
const HOUR_MS = 60 * 60 * 1000

/** Builds an unsigned JWT whose payload carries the given expiry (epoch ms). */
function jwtExpiring(expiryMs: number, extra: Record<string, unknown> = {}): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(BASE64URL_UNSAFE, encodeBase64UrlChar)
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp: Math.floor(expiryMs / 1000), ...extra })}.sig`
}

function makeConfig(token: string): NostromoConfig {
  return { baseUrl: 'http://localhost:8090', email: 'a@b.test', token, userId: 'user-1' }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status })
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
  hydrateNostromoSync()
  hydrateNostromoConfig(undefined)
})

describe('readJwtExpiry', () => {
  it('returns the expiry in epoch milliseconds', () => {
    expect(readJwtExpiry(jwtExpiring(NOW))).toBe(NOW)
  })

  it('returns undefined for garbage input without throwing', () => {
    expect(readJwtExpiry('not-a-jwt')).toBeUndefined()
    expect(readJwtExpiry('a.@@@.c')).toBeUndefined()
    expect(readJwtExpiry('')).toBeUndefined()
  })

  it('returns undefined when the payload has no numeric exp', () => {
    expect(readJwtExpiry(`x.${btoa('{"id":"u"}')}.y`)).toBeUndefined()
  })
})

describe('ensureFreshSession', () => {
  it('reports unconfigured when no session is stored', async () => {
    await expect(ensureFreshSession(NOW)).resolves.toBe('unconfigured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps a token with plenty of lifetime left, without any request', async () => {
    hydrateNostromoConfig(makeConfig(jwtExpiring(NOW + 20 * HOUR_MS)))

    await expect(ensureFreshSession(NOW)).resolves.toBe('valid')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lets the server decide when the expiry cannot be read', async () => {
    hydrateNostromoConfig(makeConfig('garbage-token'))

    await expect(ensureFreshSession(NOW)).resolves.toBe('valid')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('marks an expired token auth-required and sends no request', async () => {
    hydrateNostromoConfig(makeConfig(jwtExpiring(NOW - 1000)))

    await expect(ensureFreshSession(NOW)).resolves.toBe('expired')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getNostromoSyncStatus()).toBe('auth-required')
    expect(getNostromoLog().at(-1)?.message).toBe('Session Nostromo expirée : reconnexion nécessaire.')
  })

  it('refreshes and persists a token close to expiry', async () => {
    const fresh = jwtExpiring(NOW + 720 * HOUR_MS)
    hydrateNostromoConfig(makeConfig(jwtExpiring(NOW + HOUR_MS)))
    fetchMock.mockResolvedValue(jsonResponse(200, { token: fresh }))

    await expect(ensureFreshSession(NOW)).resolves.toBe('refreshed')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8090/api/collections/users/auth-refresh')
    expect(init.method).toBe('POST')
    expect(getConfig()?.token).toBe(fresh)
    expect(getConfig()?.userId).toBe('user-1')
  })

  it('refreshes once even with five concurrent callers', async () => {
    const fresh = jwtExpiring(NOW + 720 * HOUR_MS)
    hydrateNostromoConfig(makeConfig(jwtExpiring(NOW + HOUR_MS)))
    fetchMock.mockResolvedValue(jsonResponse(200, { token: fresh }))

    const results = await Promise.all(Array.from({ length: 5 }, () => ensureFreshSession(NOW)))

    expect(results.every((result) => result === 'refreshed')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('marks the session expired when the refresh is rejected with 401', async () => {
    hydrateNostromoConfig(makeConfig(jwtExpiring(NOW + HOUR_MS)))
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'invalid token', status: 401 }))

    await expect(ensureFreshSession(NOW)).resolves.toBe('expired')
    expect(getNostromoSyncStatus()).toBe('auth-required')
  })

  it('keeps the token and the status when the refresh fails offline', async () => {
    const token = jwtExpiring(NOW + HOUR_MS)
    hydrateNostromoConfig(makeConfig(token))
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(ensureFreshSession(NOW)).resolves.toBe('valid')
    expect(getConfig()?.token).toBe(token)
    expect(getNostromoSyncStatus()).not.toBe('auth-required')
  })

  it('refreshes inside the margin only', () => {
    expect(SESSION_REFRESH_MARGIN_MS).toBeLessThan(24 * HOUR_MS)
  })
})
