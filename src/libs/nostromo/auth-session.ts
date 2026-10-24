/**
 * Session lifecycle of the Nostromo token: expiry reading, proactive refresh
 * and the transition to `auth-required` when the session is over.
 *
 * The JWT is read without signature check: the server stays the authority, a
 * token it rejects still surfaces as a 401 in the client. Refresh uses the
 * server's `auth-refresh` route, verified on PocketBase 0.40.4.
 */

import type { SessionHealth } from './auth-session.d'
import { NostromoClientError, refreshAuth } from './client'
import { getConfig, isConfigured, setConfig } from './nostromo-config-store'
import { pushNostromoLog, setNostromoSyncStatus } from './nostromo-sync-store'

const MS_PER_HOUR = 60 * 60 * 1000

/**
 * Refresh when less than this remains. The measured users JWT lasts 432000 s (120 h),
 * so 6 h is 5 % of the lifetime and keeps refreshes rare.
 */
export const SESSION_REFRESH_MARGIN_MS = 6 * MS_PER_HOUR

const JWT_PAYLOAD_SEGMENT_INDEX = 1
const JWT_SEGMENT_SEPARATOR = '.'
const BASE64URL_PADDING_MODULO = 4
const BASE64URL_NON_STANDARD = /[-_]/g
const BASE64URL_REPLACEMENTS: Record<string, string> = { _: '/', '-': '+' }
const SECONDS_TO_MS = 1000
const SESSION_EXPIRED_LOG = 'Session Nostromo expirée : reconnexion nécessaire.'

/** Converts a base64url segment to padded standard base64, the form `atob` expects. */
function toBase64(segment: string): string {
  const standard = segment.replace(
    BASE64URL_NON_STANDARD,
    (character) => BASE64URL_REPLACEMENTS[character] ?? character
  )
  const missingPadding =
    (BASE64URL_PADDING_MODULO - (standard.length % BASE64URL_PADDING_MODULO)) % BASE64URL_PADDING_MODULO
  return standard + '='.repeat(missingPadding)
}

let refreshInFlight: Promise<SessionHealth> | undefined

/**
 * Expiry of a JWT in epoch milliseconds, or `undefined` for any malformed input.
 * Never throws: a garbage token is a token whose expiry is unknown.
 */
export function readJwtExpiry(token: string): number | undefined {
  try {
    const segment = token.split(JWT_SEGMENT_SEPARATOR)[JWT_PAYLOAD_SEGMENT_INDEX]
    if (!segment) {
      return undefined
    }
    const payload: unknown = JSON.parse(atob(toBase64(segment)))
    const { exp } = payload as { exp?: unknown }
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * SECONDS_TO_MS : undefined
  } catch {
    return undefined
  }
}

/**
 * Makes sure the stored token is usable before a call: refreshes it when it is
 * close to expiry, and marks the session `auth-required` once it has expired.
 * Concurrent callers share one refresh.
 */
export function ensureFreshSession(now: number = Date.now()): Promise<SessionHealth> {
  if (refreshInFlight) {
    return refreshInFlight
  }
  const run = Promise.resolve(checkSession(now)).finally(() => {
    refreshInFlight = undefined
  })
  refreshInFlight = run
  return run
}

function checkSession(now: number): SessionHealth | Promise<SessionHealth> {
  if (!isConfigured()) {
    return 'unconfigured'
  }
  const config = getConfig()
  if (!config) {
    return 'unconfigured'
  }

  const expiry = readJwtExpiry(config.token)
  if (expiry === undefined) {
    return 'valid'
  }
  if (expiry <= now) {
    return markExpired()
  }
  if (expiry - now >= SESSION_REFRESH_MARGIN_MS) {
    return 'valid'
  }
  return refreshSession(config.baseUrl, config.token, config.email, config.userId)
}

async function refreshSession(baseUrl: string, token: string, email: string, userId: string): Promise<SessionHealth> {
  try {
    const refreshed = await refreshAuth(baseUrl, token)
    setConfig({ baseUrl, email, token: refreshed.token, userId })
    return 'refreshed'
  } catch (error) {
    if (error instanceof NostromoClientError && error.kind === 'auth') {
      return markExpired()
    }
    // Offline or server down: keep the token, the next trigger tries again.
    return 'valid'
  }
}

function markExpired(): SessionHealth {
  pushNostromoLog('warn', SESSION_EXPIRED_LOG)
  setNostromoSyncStatus('auth-required')
  return 'expired'
}
