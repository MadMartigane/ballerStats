import { afterEach, describe, expect, it, vi } from 'vitest'
import { getNostromoBaseUrl } from './env'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getNostromoBaseUrl', () => {
  it('returns undefined when the variable is absent (offline only)', () => {
    vi.stubEnv('VITE_NOSTROMO_URL', undefined as unknown as string)
    expect(getNostromoBaseUrl()).toBeUndefined()
  })

  it('returns the empty string for an empty value (same origin)', () => {
    vi.stubEnv('VITE_NOSTROMO_URL', '')
    expect(getNostromoBaseUrl()).toBe('')
  })

  it('returns the trimmed absolute origin', () => {
    vi.stubEnv('VITE_NOSTROMO_URL', '  http://localhost:8090  ')
    expect(getNostromoBaseUrl()).toBe('http://localhost:8090')
  })

  it('treats a path prefix as unconfigured, without throwing', () => {
    vi.stubEnv('VITE_NOSTROMO_URL', '/nostromo')
    expect(getNostromoBaseUrl()).toBeUndefined()
  })
})
