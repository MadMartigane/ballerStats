/**
 * Build-time configuration of the Nostromo backend.
 *
 * The client (`./client.ts`) is deliberately stateless: it never reads the
 * environment itself, every call receives the base url as an argument. This
 * module is the single place where the build-time value becomes a runtime one,
 * so the sync layer and the pages have one source of truth.
 */

/**
 * Base url of the Nostromo backend, or `undefined` when the app is built
 * without one. Callers treat `undefined` as "offline only": the app stays
 * usable, it simply cannot reach the backend (see the integration guide, 4.6).
 */
export function getNostromoBaseUrl(): string | undefined {
  const value = import.meta.env.VITE_NOSTROMO_URL
  if (typeof value !== 'string') {
    return undefined
  }
  const baseUrl = value.trim()
  return baseUrl.length > 0 ? baseUrl : undefined
}
