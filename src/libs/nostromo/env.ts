/**
 * Build-time configuration of the Nostromo backend.
 *
 * The client (`./client.ts`) is deliberately stateless: it never reads the
 * environment itself, every call receives the base url as an argument. This
 * module is the single place where the build-time value becomes a runtime one,
 * so the sync layer and the pages have one source of truth.
 *
 * The base url is an ORIGIN or the empty string, never a path prefix. The client
 * concatenates `${baseUrl}/api/...`, so:
 * - `undefined` (variable absent): no backend, offline only,
 * - `''`: same origin, requests go to `/api/...` on the page host (dev proxy or
 *   the nginx host in production),
 * - `http://host:8090`: requests go to `http://host:8090/api/...`.
 */

const PATH_PREFIX_MARKER = '/'

/**
 * Base url of the Nostromo backend, or `undefined` when the app is built
 * without one. Callers treat `undefined` as "offline only": the app stays
 * usable, it simply cannot reach the backend (see the integration guide, 4.6).
 * A value that starts with `/` is a path prefix, which is not supported: it is
 * treated as absent, without a throw or a log line.
 */
export function getNostromoBaseUrl(): string | undefined {
  const value = import.meta.env.VITE_NOSTROMO_URL
  if (typeof value !== 'string') {
    return undefined
  }
  const baseUrl = value.trim()
  if (baseUrl.startsWith(PATH_PREFIX_MARKER)) {
    return undefined
  }
  return baseUrl
}
