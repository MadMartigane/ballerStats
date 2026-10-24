import { beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadFile, getDocument, getFileToken, NostromoClientError } from './client'
import type { NostromoDocument } from './client.d'
import {
  assertPhotoIntegrity,
  createFileTokenSession,
  downloadPhoto,
  PHOTO_MAX_ATTEMPTS,
  PHOTO_RETRY_BASE_DELAY_MS,
} from './photo-sync'

vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  downloadFile: vi.fn(),
  getDocument: vi.fn(),
  getFileToken: vi.fn(),
}))
vi.mock('./nostromo-sync-store', () => ({ pushNostromoLog: vi.fn() }))
vi.mock('../photo-store/photo-store', () => ({ getAllPhotoEntries: vi.fn(() => Promise.resolve([])) }))
vi.mock('../store/store', () => ({ storePlayers: vi.fn(() => Promise.resolve()) }))
vi.mock('./limits', () => ({ NOSTROMO_MAX_PHOTO_BYTES: 1024 * 1024 }))
vi.mock('../stores/players-store', () => ({ getRawPlayers: vi.fn(() => []), hydratePlayers: vi.fn() }))

const CONFIG = { baseUrl: 'http://localhost:8090', email: 'a@b.test', token: 'auth-token', userId: 'u1' }
const DOC: NostromoDocument = { file: 'p1.webp', id: 'doc1', owner: 'u1', payload: {}, updated: '', version: 1 }

function image(bytes = 'image-bytes'): Blob {
  return new Blob([bytes], { type: 'image/webp' })
}

function failure(kind: 'network' | 'notfound' | 'unknown' | 'auth', status?: number): NostromoClientError {
  return new NostromoClientError('boom', { kind, status })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.mocked(getFileToken).mockResolvedValue('file-token')
})

async function settle<T>(promise: Promise<T>): Promise<T | unknown> {
  const outcome = promise.then(
    (value) => value,
    (error: unknown) => error
  )
  await vi.runAllTimersAsync()
  return outcome
}

describe('photo-sync', () => {
  it('mints the file token once for a whole batch', async () => {
    vi.mocked(downloadFile).mockImplementation(() => Promise.resolve(image()))
    const session = createFileTokenSession(CONFIG)

    await downloadPhoto(CONFIG, session, DOC)
    await downloadPhoto(CONFIG, session, { ...DOC, id: 'doc2' })

    expect(getFileToken).toHaveBeenCalledTimes(1)
  })

  it('retries a network failure with a 1 s then 2 s backoff, then succeeds', async () => {
    vi.mocked(downloadFile)
      .mockRejectedValueOnce(failure('network'))
      .mockRejectedValueOnce(failure('unknown', 503))
      .mockResolvedValueOnce(image())

    const outcome = await settle(downloadPhoto(CONFIG, createFileTokenSession(CONFIG), DOC))

    expect(outcome).toBeInstanceOf(Blob)
    expect(downloadFile).toHaveBeenCalledTimes(PHOTO_MAX_ATTEMPTS)
  })

  it('waits 1 s before the second attempt', async () => {
    vi.mocked(downloadFile).mockRejectedValueOnce(failure('network')).mockResolvedValueOnce(image())
    const pending = downloadPhoto(CONFIG, createFileTokenSession(CONFIG), DOC)

    await vi.advanceTimersByTimeAsync(PHOTO_RETRY_BASE_DELAY_MS - 1)
    expect(downloadFile).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await pending

    expect(downloadFile).toHaveBeenCalledTimes(2)
  })

  it('gives up after three attempts', async () => {
    vi.mocked(downloadFile).mockRejectedValue(failure('network'))

    const outcome = await settle(downloadPhoto(CONFIG, createFileTokenSession(CONFIG), DOC))

    expect(outcome).toBeInstanceOf(NostromoClientError)
    expect(downloadFile).toHaveBeenCalledTimes(PHOTO_MAX_ATTEMPTS)
  })

  it('never retries a 404 and keeps it when the document file did not change', async () => {
    vi.mocked(downloadFile).mockRejectedValue(failure('notfound', 404))
    vi.mocked(getDocument).mockResolvedValue(DOC)

    const outcome = await settle(downloadPhoto(CONFIG, createFileTokenSession(CONFIG), DOC))

    expect(outcome).toBeInstanceOf(NostromoClientError)
    expect(downloadFile).toHaveBeenCalledTimes(1)
  })

  it('refetches the file token once on a 401', async () => {
    vi.mocked(getFileToken).mockResolvedValueOnce('old').mockResolvedValueOnce('new')
    vi.mocked(downloadFile).mockRejectedValueOnce(failure('auth', 401)).mockResolvedValueOnce(image())

    await settle(downloadPhoto(CONFIG, createFileTokenSession(CONFIG), DOC))

    expect(getFileToken).toHaveBeenCalledTimes(2)
    expect(downloadFile).toHaveBeenLastCalledWith(CONFIG.baseUrl, 'new', 'doc1', 'p1.webp')
  })

  it('refuses an empty, non-image, oversized or truncated file', () => {
    expect(() => assertPhotoIntegrity(new Blob([], { type: 'image/webp' }), DOC)).toThrow('vide')
    expect(() => assertPhotoIntegrity(new Blob(['x'], { type: 'text/html' }), DOC)).toThrow('pas une image')
    expect(() => assertPhotoIntegrity(image('abc'), { ...DOC, fileSize: 10 })).toThrow('tronqué')
    expect(() => assertPhotoIntegrity(image('abc'), { ...DOC, fileSize: 3 })).not.toThrow()
  })
})
