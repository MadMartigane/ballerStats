import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  authWithPassword,
  checkHealth,
  createDocument,
  deleteDocument,
  downloadFile,
  generateDocId15,
  getDocument,
  getFileToken,
  listDocuments,
  NostromoClientError,
  photoDocId,
  toPocketBaseTimestamp,
  updateDocument,
  uploadDocumentFile,
} from './client'
import type { NostromoDocument } from './client.d'

const BASE_URL = 'http://localhost:8090'
const AUTH_TOKEN = 'auth-token-raw-value'
const DOC_ID = 'a1b2c3d4e5f6g7h'
const FILE_TOKEN = 'file-token-short-lived'
const OWNER_ID = 'user-owner-001'
const NATIVE_TIMESTAMP = '2026-09-15 19:33:23.802Z'
const DOCUMENT_ID_PATTERN = /^[a-z0-9]{15}$/
const ISO_TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}/

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

interface RecordedRequest {
  body: unknown
  headers: Record<string, string>
  method: string
  url: string
}

function recordedRequest(index = 0): RecordedRequest {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit]
  return {
    body: init.body,
    headers: init.headers as Record<string, string>,
    method: init.method ?? '',
    url,
  }
}

function mockResponse(status: number, body?: unknown, contentType = 'application/json'): Response {
  const payload = body === undefined ? null : JSON.stringify(body)
  return new Response(payload, { headers: { 'Content-Type': contentType }, status })
}

function serveStatus(status: number, message?: string): void {
  fetchMock.mockResolvedValue(mockResponse(status, message === undefined ? undefined : { message, status }))
}

function makeRecord(overrides: Partial<NostromoDocument> = {}): Record<string, unknown> {
  return {
    collectionName: 'documents',
    file: '',
    id: DOC_ID,
    owner: OWNER_ID,
    payload: { points: 12 },
    updated: NATIVE_TIMESTAMP,
    version: 1,
    ...overrides,
  }
}

describe('authWithPassword', () => {
  it('posts the credentials and returns the token with the user id', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { record: { id: OWNER_ID }, token: 'token-1' }))

    const result = await authWithPassword(BASE_URL, 'coach@example.com', 'secret')

    expect(result).toEqual({ token: 'token-1', userId: OWNER_ID })
    const request = recordedRequest()
    expect(request.url).toBe(`${BASE_URL}/api/collections/users/auth-with-password`)
    expect(request.method).toBe('POST')
    expect(JSON.parse(request.body as string)).toEqual({ identity: 'coach@example.com', password: 'secret' })
    expect(request.headers.Authorization).toBeUndefined()
  })

  it('rejects a 400 as a validation error and never yields a token', async () => {
    serveStatus(400, 'Failed to authenticate.')

    await expect(authWithPassword(BASE_URL, 'coach@example.com', 'wrong')).rejects.toMatchObject({
      kind: 'validation',
      status: 400,
    })
  })

  it('rejects a 200 without a token', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { record: { id: OWNER_ID } }))

    await expect(authWithPassword(BASE_URL, 'coach@example.com', 'secret')).rejects.toMatchObject({ kind: 'auth' })
  })
})

describe('createDocument', () => {
  it('creates with the client id and the owner, and returns version 1', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, makeRecord({ version: 1 })))

    const document = await createDocument(BASE_URL, AUTH_TOKEN, {
      id: DOC_ID,
      owner: OWNER_ID,
      payload: { points: 12 },
    })

    expect(document).toEqual({
      id: DOC_ID,
      owner: OWNER_ID,
      payload: { points: 12 },
      updated: NATIVE_TIMESTAMP,
      version: 1,
    })
    expect(document.file).toBeUndefined()
    const request = recordedRequest()
    expect(request.url).toBe(`${BASE_URL}/api/collections/documents/records`)
    expect(request.method).toBe('POST')
    expect(JSON.parse(request.body as string)).toEqual({ id: DOC_ID, owner: OWNER_ID, payload: { points: 12 } })
  })

  it('sends the token as the raw Authorization header, without a Bearer prefix', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, makeRecord()))

    await createDocument(BASE_URL, AUTH_TOKEN, { id: DOC_ID, owner: OWNER_ID })

    const request = recordedRequest()
    expect(request.headers.Authorization).toBe(AUTH_TOKEN)
    expect(JSON.stringify(request.headers)).not.toContain('Bearer')
    expect(request.headers['Content-Type']).toBe('application/json')
  })

  it('refuses a malformed id before reaching the server', async () => {
    await expect(createDocument(BASE_URL, AUTH_TOKEN, { id: 'NOT-AN-ID', owner: OWNER_ID })).rejects.toMatchObject({
      kind: 'validation',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps a 400 duplicate id to a validation error carrying the server message', async () => {
    serveStatus(400, 'Failed to create record.')

    const error = await captureError(() => createDocument(BASE_URL, AUTH_TOKEN, { id: DOC_ID, owner: OWNER_ID }))

    expect(error.kind).toBe('validation')
    expect(error.status).toBe(400)
    expect(error.message).toContain('Failed to create record.')
  })
})

describe('getDocument', () => {
  it('reads one document by id and keeps the version', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, makeRecord({ version: 7 })))

    const document = await getDocument(BASE_URL, AUTH_TOKEN, DOC_ID)

    expect(document.version).toBe(7)
    const request = recordedRequest()
    expect(request.url).toBe(`${BASE_URL}/api/collections/documents/records/${DOC_ID}`)
    expect(request.headers.Authorization).toBe(AUTH_TOKEN)
  })

  it('maps 401 to the auth kind', async () => {
    serveStatus(401, 'The request requires valid record authorization token.')

    await expect(getDocument(BASE_URL, 'expired', DOC_ID)).rejects.toMatchObject({ kind: 'auth', status: 401 })
  })

  it('maps 404 to the notfound kind', async () => {
    serveStatus(404, 'Record not found.')

    await expect(getDocument(BASE_URL, AUTH_TOKEN, DOC_ID)).rejects.toMatchObject({ kind: 'notfound', status: 404 })
  })
})

describe('updateDocument', () => {
  it('sends the held version as expectedVersion and returns the bumped version', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, makeRecord({ version: 3 })))

    const document = await updateDocument(BASE_URL, AUTH_TOKEN, DOC_ID, {
      expectedVersion: 2,
      payload: { points: 18 },
    })

    expect(document.version).toBe(3)
    const request = recordedRequest()
    expect(request.method).toBe('PATCH')
    expect(request.url).toBe(`${BASE_URL}/api/collections/documents/records/${DOC_ID}`)
    expect(JSON.parse(request.body as string)).toEqual({ expectedVersion: 2, payload: { points: 18 } })
  })

  it('maps 409 to the conflict kind and exposes the server message', async () => {
    serveStatus(409, 'stale write: document version is 5')

    const error = await captureError(() =>
      updateDocument(BASE_URL, AUTH_TOKEN, DOC_ID, { expectedVersion: 2, payload: {} })
    )

    expect(error).toBeInstanceOf(NostromoClientError)
    expect(error.kind).toBe('conflict')
    expect(error.status).toBe(409)
    expect(error.message).toContain('stale write: document version is 5')
  })
})

describe('deleteDocument', () => {
  it('accepts a 204 and sends the raw token', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(deleteDocument(BASE_URL, AUTH_TOKEN, DOC_ID)).resolves.toBeUndefined()

    const request = recordedRequest()
    expect(request.method).toBe('DELETE')
    expect(request.url).toBe(`${BASE_URL}/api/collections/documents/records/${DOC_ID}`)
    expect(request.headers.Authorization).toBe(AUTH_TOKEN)
  })

  it('maps 404 to the notfound kind', async () => {
    serveStatus(404)

    await expect(deleteDocument(BASE_URL, AUTH_TOKEN, DOC_ID)).rejects.toMatchObject({ kind: 'notfound' })
  })
})

describe('listDocuments', () => {
  it('builds the paging and native timestamp query and returns the envelope', async () => {
    fetchMock.mockResolvedValue(
      mockResponse(200, { items: [makeRecord({ version: 4 })], page: 1, perPage: 500, totalItems: 1, totalPages: 1 })
    )

    const result = await listDocuments(BASE_URL, AUTH_TOKEN, {
      filter: `updated>='${NATIVE_TIMESTAMP}'`,
      page: 1,
      perPage: 500,
    })

    expect(result).toEqual({
      items: [{ id: DOC_ID, owner: OWNER_ID, payload: { points: 12 }, updated: NATIVE_TIMESTAMP, version: 4 }],
      page: 1,
      perPage: 500,
      totalItems: 1,
    })

    const url = new URL(recordedRequest().url)
    expect(url.pathname).toBe('/api/collections/documents/records')
    expect(url.searchParams.get('filter')).toBe(`updated>='${NATIVE_TIMESTAMP}'`)
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('perPage')).toBe('500')
    // The ISO `T` form silently matches zero rows: it must never reach the query.
    expect(recordedRequest().url).not.toMatch(ISO_TIMESTAMP_PATTERN)
  })

  it('omits the parameters that are not provided', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { items: [], page: 1, perPage: 30, totalItems: 0 }))

    const result = await listDocuments(BASE_URL, AUTH_TOKEN)

    expect(result.items).toEqual([])
    expect(recordedRequest().url).toBe(`${BASE_URL}/api/collections/documents/records`)
  })

  it('treats an empty list as a normal answer, not an error', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { items: [], page: 1, perPage: 500, totalItems: 0 }))

    const result = await listDocuments(BASE_URL, AUTH_TOKEN, { filter: `id='${DOC_ID}'` })

    expect(result.totalItems).toBe(0)
  })
})

describe('uploadDocumentFile', () => {
  it('patches multipart with expectedVersion as a string field and bumps the version', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, makeRecord({ file: 'photo_abc123.jpg', version: 4 })))

    const document = await uploadDocumentFile(BASE_URL, AUTH_TOKEN, DOC_ID, {
      expectedVersion: 3,
      file: new Blob(['jpeg-bytes'], { type: 'image/jpeg' }),
      filename: 'photo.jpg',
    })

    expect(document.file).toBe('photo_abc123.jpg')
    expect(document.version).toBe(4)
    const request = recordedRequest()
    expect(request.method).toBe('PATCH')
    expect(request.url).toBe(`${BASE_URL}/api/collections/documents/records/${DOC_ID}`)
    expect(request.headers.Authorization).toBe(AUTH_TOKEN)
    expect(request.headers['Content-Type']).toBeUndefined()

    const form = request.body as FormData
    expect(form).toBeInstanceOf(FormData)
    const expectedVersion = form.get('expectedVersion')
    expect(typeof expectedVersion).toBe('string')
    expect(expectedVersion).toBe('3')
    const file = form.get('file') as File
    expect(file).toBeInstanceOf(Blob)
    expect(file.name).toBe('photo.jpg')
  })

  it('maps a 409 from a stale upload to the conflict kind', async () => {
    serveStatus(409, 'stale write: document version is 9')

    await expect(
      uploadDocumentFile(BASE_URL, AUTH_TOKEN, DOC_ID, {
        expectedVersion: 3,
        file: new Blob(['bytes']),
        filename: 'photo.jpg',
      })
    ).rejects.toMatchObject({ kind: 'conflict', status: 409 })
  })
})

describe('getFileToken and downloadFile', () => {
  it('mints a file token with the raw auth header and downloads with it as a query parameter', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { token: FILE_TOKEN }))
    fetchMock.mockResolvedValueOnce(new Response('file-bytes', { status: 200 }))

    const fileToken = await getFileToken(BASE_URL, AUTH_TOKEN)
    expect(fileToken).toBe(FILE_TOKEN)

    const mintRequest = recordedRequest()
    expect(mintRequest.method).toBe('POST')
    expect(mintRequest.url).toBe(`${BASE_URL}/api/files/token`)
    expect(mintRequest.headers.Authorization).toBe(AUTH_TOKEN)

    const blob = await downloadFile(BASE_URL, fileToken, DOC_ID, 'photo.jpg')

    const downloadRequest = recordedRequest(1)
    expect(downloadRequest.method).toBe('GET')
    expect(downloadRequest.url).toBe(
      `${BASE_URL}/api/files/documents/${DOC_ID}/photo.jpg?token=${encodeURIComponent(FILE_TOKEN)}`
    )
    // The auth header alone is not sufficient on a file url: the token travels in the query.
    expect(downloadRequest.headers.Authorization).toBeUndefined()
    await expect(blob.text()).resolves.toBe('file-bytes')
  })

  it('keeps the file token out of the error message when the download is refused', async () => {
    serveStatus(404, 'Not found.')

    const error = await captureError(() => downloadFile(BASE_URL, FILE_TOKEN, DOC_ID, 'photo.jpg'))

    expect(error.kind).toBe('notfound')
    expect(error.message).not.toContain(FILE_TOKEN)
    expect(error.message).toContain('/api/files/documents/')
  })
})

describe('checkHealth', () => {
  it('resolves on 200 without sending any token', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

    await expect(checkHealth(BASE_URL)).resolves.toBeUndefined()

    const request = recordedRequest()
    expect(request.url).toBe(`${BASE_URL}/api/health`)
    expect(request.headers.Authorization).toBeUndefined()
  })

  it('throws on a non-2xx answer', async () => {
    serveStatus(500, 'Internal server error.')

    await expect(checkHealth(BASE_URL)).rejects.toMatchObject({ kind: 'unknown', status: 500 })
  })

  it('throws on a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(checkHealth(BASE_URL)).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('network failures', () => {
  it('maps a fetch TypeError to the network kind without leaking the token', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await captureError(() => getDocument(BASE_URL, AUTH_TOKEN, DOC_ID))

    expect(error.kind).toBe('network')
    expect(error.status).toBeUndefined()
    expect(error.message).not.toContain(AUTH_TOKEN)
  })

  it('normalizes trailing slashes of the base url', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, makeRecord()))

    await getDocument(`${BASE_URL}/`, AUTH_TOKEN, DOC_ID)

    expect(recordedRequest().url).toBe(`${BASE_URL}/api/collections/documents/records/${DOC_ID}`)
  })

  it('rejects a 200 whose body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>oops</html>', { status: 200 }))

    await expect(getDocument(BASE_URL, AUTH_TOKEN, DOC_ID)).rejects.toMatchObject({ kind: 'unknown' })
  })

  it('falls back to the status text when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 502 }))

    const error = await captureError(() => getDocument(BASE_URL, AUTH_TOKEN, DOC_ID))

    expect(error.status).toBe(502)
    expect(error.message).toContain('502')
  })
})

describe('generateDocId15', () => {
  it('returns 15 lowercase alphanumeric characters', () => {
    expect(generateDocId15()).toMatch(DOCUMENT_ID_PATTERN)
  })

  it('does not repeat itself', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateDocId15()))

    expect(ids.size).toBe(200)
  })
})

describe('photoDocId', () => {
  it('matches the id pattern', () => {
    expect(photoDocId('player-1')).toMatch(DOCUMENT_ID_PATTERN)
  })

  it('is deterministic for a given player id', () => {
    expect(photoDocId('player-1')).toBe(photoDocId('player-1'))
    expect(photoDocId('player-1')).toBe('hxr2rfuf4vw2v4u')
    expect(photoDocId('player-2')).toBe('p79c1rofuhtea7r')
  })

  it('separates distinct player ids', () => {
    const ids = new Set(Array.from({ length: 500 }, (_, index) => photoDocId(`player-${index}`)))

    expect(ids.size).toBe(500)
  })

  it('accepts any player id shape, including an empty one', () => {
    expect(photoDocId('')).toMatch(DOCUMENT_ID_PATTERN)
    expect(photoDocId('Prénom Éléphant / 42')).toMatch(DOCUMENT_ID_PATTERN)
  })
})

describe('toPocketBaseTimestamp', () => {
  it('converts a date to the native layout without the ISO T separator', () => {
    const timestamp = toPocketBaseTimestamp(new Date('2026-09-15T19:33:23.802Z'))

    expect(timestamp).toBe(NATIVE_TIMESTAMP)
    expect(timestamp).not.toContain('T')
  })

  it('converts an ISO string to the native layout', () => {
    expect(toPocketBaseTimestamp('2026-09-15T19:33:23.802Z')).toBe(NATIVE_TIMESTAMP)
  })

  it('keeps a native timestamp untouched', () => {
    expect(toPocketBaseTimestamp(NATIVE_TIMESTAMP)).toBe(NATIVE_TIMESTAMP)
  })

  it('rejects a value that is not a date', () => {
    expect(() => toPocketBaseTimestamp('not a date')).toThrow(NostromoClientError)
    expect(() => toPocketBaseTimestamp('not a date')).toThrow('Impossible de construire un horodatage')
  })
})

async function captureError(action: () => Promise<unknown>): Promise<NostromoClientError> {
  try {
    await action()
  } catch (error) {
    if (error instanceof NostromoClientError) {
      return error
    }
    throw error
  }
  throw new Error('Expected the call to fail, but it resolved.')
}
