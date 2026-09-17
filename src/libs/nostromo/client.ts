/**
 * Plain-fetch client for the Nostromo backend (PocketBase 0.40.4 core).
 *
 * Contract: the Nostromo SDK integration guide, sections 3 and 4. Rules this
 * module enforces on every call:
 *
 * - no global state: the base url and the auth token are arguments of each call,
 * - the auth token travels as the raw `Authorization` header value, never with
 *   a `Bearer ` prefix,
 * - a token is never logged and never embedded in an error message,
 * - every failure is a `NostromoClientError` whose `kind` says what to do next.
 */
import type {
  NostromoAuthResult,
  NostromoCreateDocumentInput,
  NostromoDocument,
  NostromoErrorKind,
  NostromoListOptions,
  NostromoListResult,
  NostromoUpdateDocumentInput,
  NostromoUploadFileInput,
} from './client.d'

/** Document ids are exactly 15 lowercase alphanumeric characters (`^[a-z0-9]{15}$`). */
export const DOCUMENT_ID_LENGTH = 15

const DOCUMENT_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const DOCUMENT_ID_PATTERN = /^[a-z0-9]{15}$/
const DOCUMENT_ID_RADIX = BigInt(DOCUMENT_ID_ALPHABET.length)
/** Number of distinct ids the base-36 alphabet can express in 15 characters (36^15). */
const DOCUMENT_ID_SPACE = DOCUMENT_ID_RADIX ** BigInt(DOCUMENT_ID_LENGTH)

const DOCUMENTS_PATH = '/api/collections/documents/records'
const FILES_PATH = '/api/files/documents'
const FILES_TOKEN_PATH = '/api/files/token'
const HEALTH_PATH = '/api/health'
const USERS_AUTH_PATH = '/api/collections/users/auth-with-password'

const JSON_HEADERS: Record<string, string> = { 'Content-Type': 'application/json' }
const TRAILING_SLASHES = /\/+$/
const QUERY_SEPARATOR = '&'

/** FNV-1a 64-bit parameters, doubled with two lanes and two salts to spread 128 bits. */
const FNV_OFFSET_PRIMARY = 0xcbf2_9ce4_8422_2325n
const FNV_OFFSET_SECONDARY = 0x9e37_79b9_7f4a_7c15n
const FNV_PRIME_64 = 0x100_0000_01b3n
const TWO_POW_64 = 2n ** 64n
const PHOTO_ID_SALT_PRIMARY = 'nostromo:document:photo'
const PHOTO_ID_SALT_SECONDARY = 'nostromo:document:photo:alternate'

const NATIVE_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z$/

type NostromoMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST'

interface NostromoRequestOptions {
  baseUrl: string
  body?: BodyInit
  headers?: Record<string, string>
  method: NostromoMethod
  path: string
  token?: string
}

/** The shape a PocketBase record or a list item is read from, before validation. */
interface RawRecord {
  file?: unknown
  id?: unknown
  owner?: unknown
  payload?: unknown
  updated?: unknown
  version?: unknown
}

interface RawListBody {
  items?: unknown
  page?: unknown
  perPage?: unknown
  totalItems?: unknown
}

/** Constructor options of `NostromoClientError`, in the shape of the standard `Error` options. */
export interface NostromoClientErrorOptions extends ErrorOptions {
  /** What went wrong: the stable branch key for callers. */
  kind: NostromoErrorKind
  /** HTTP status when the server answered; absent on a transport failure. */
  status?: number
}

/**
 * Every failure of this module. `kind` is the stable contract for callers,
 * `status` is the HTTP status when the server answered (absent on a network
 * failure), and the message is French, human readable, and never carries the
 * auth token or the file token. A server-provided detail is passed through
 * verbatim, in whatever language the server wrote it.
 *
 * The signature mirrors `Error(message, options)` so the original error can
 * always be preserved in `cause`.
 */
export class NostromoClientError extends Error {
  readonly kind: NostromoErrorKind
  readonly status?: number

  constructor(message: string, options: NostromoClientErrorOptions) {
    super(message, options)
    this.name = 'NostromoClientError'
    this.kind = options.kind
    this.status = options.status
  }
}

/** `GET /api/health`: throws when the instance is unreachable or not healthy. */
export async function checkHealth(baseUrl: string): Promise<void> {
  await send({ baseUrl, method: 'GET', path: HEALTH_PATH })
}

/**
 * Authenticates a user with email and password.
 * Never cache a token from a rejected call: on any non-200 answer this throws.
 */
export async function authWithPassword(baseUrl: string, email: string, password: string): Promise<NostromoAuthResult> {
  const body = await requestJson<{ record?: { id?: unknown }; token?: unknown }>({
    baseUrl,
    body: JSON.stringify({ identity: email, password }),
    headers: JSON_HEADERS,
    method: 'POST',
    path: USERS_AUTH_PATH,
  })

  const label = requestLabel('POST', USERS_AUTH_PATH)
  if (typeof body.token !== 'string' || body.token.length === 0) {
    throw new NostromoClientError(`${label} n'a renvoyé aucun jeton.`, { kind: 'auth' })
  }
  const userId = body.record?.id
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new NostromoClientError(`${label} n'a renvoyé aucun identifiant utilisateur.`, { kind: 'auth' })
  }
  return { token: body.token, userId }
}

/** Reads one document. A 404 means "no read access" or "gone", never just "deleted". */
export async function getDocument(baseUrl: string, token: string, id: string): Promise<NostromoDocument> {
  const path = `${DOCUMENTS_PATH}/${encodeURIComponent(id)}`
  const body = await requestJson<unknown>({ baseUrl, method: 'GET', path, token })
  return toDocument(body, requestLabel('GET', path))
}

/**
 * Creates a document under a client-generated id. The server answers 200 (not
 * 201), and a 400 means the id already exists OR the create rule failed: on a
 * 400 the caller must re-read the document by id before deciding.
 */
export async function createDocument(
  baseUrl: string,
  token: string,
  input: NostromoCreateDocumentInput
): Promise<NostromoDocument> {
  const label = requestLabel('POST', DOCUMENTS_PATH)
  if (!DOCUMENT_ID_PATTERN.test(input.id)) {
    throw new NostromoClientError(`${label} exige un id correspondant à ^[a-z0-9]{15}$.`, { kind: 'validation' })
  }

  const body = await requestJson<unknown>({
    baseUrl,
    body: JSON.stringify({ id: input.id, owner: input.owner, payload: input.payload }),
    headers: JSON_HEADERS,
    method: 'POST',
    path: DOCUMENTS_PATH,
    token,
  })
  return toDocument(body, label)
}

/**
 * Updates a document. `expectedVersion` is mandatory: a missing or stale value
 * is answered with 409, which the caller must resolve (re-pull and re-apply, or
 * surface the conflict), never silently retry.
 */
export async function updateDocument(
  baseUrl: string,
  token: string,
  id: string,
  input: NostromoUpdateDocumentInput
): Promise<NostromoDocument> {
  const path = `${DOCUMENTS_PATH}/${encodeURIComponent(id)}`
  const body = await requestJson<unknown>({
    baseUrl,
    body: JSON.stringify({ expectedVersion: input.expectedVersion, payload: input.payload }),
    headers: JSON_HEADERS,
    method: 'PATCH',
    path,
    token,
  })
  return toDocument(body, requestLabel('PATCH', path))
}

/** Deletes a document (204, empty body). Server-side deletion is permanent. */
export async function deleteDocument(baseUrl: string, token: string, id: string): Promise<void> {
  await send({ baseUrl, method: 'DELETE', path: `${DOCUMENTS_PATH}/${encodeURIComponent(id)}`, token })
}

/**
 * Lists the documents the caller may read: the only rights discovery mechanism
 * there is. A filter that matches nothing readable yields an empty list, which
 * is a normal answer, not an error.
 */
export async function listDocuments(
  baseUrl: string,
  token: string,
  opts: NostromoListOptions = {}
): Promise<NostromoListResult> {
  const path = `${DOCUMENTS_PATH}${toQueryString({ filter: opts.filter, page: opts.page, perPage: opts.perPage })}`
  const body = await requestJson<RawListBody>({ baseUrl, method: 'GET', path, token })
  const label = requestLabel('GET', path)
  const items = Array.isArray(body.items) ? body.items.map((item) => toDocument(item, label)) : []

  return {
    items,
    page: numberOr(body.page, 1),
    perPage: numberOr(body.perPage, items.length),
    totalItems: numberOr(body.totalItems, items.length),
  }
}

/**
 * Uploads the single file of a document with a multipart PATCH. The upload
 * bumps `version` exactly like a payload update, and `expectedVersion` travels
 * as a string form field because multipart fields always arrive as strings.
 */
export async function uploadDocumentFile(
  baseUrl: string,
  token: string,
  id: string,
  input: NostromoUploadFileInput
): Promise<NostromoDocument> {
  const path = `${DOCUMENTS_PATH}/${encodeURIComponent(id)}`
  const form = new FormData()
  form.append('expectedVersion', String(input.expectedVersion))
  form.append('file', input.file, input.filename)

  const body = await requestJson<unknown>({
    baseUrl,
    body: form,
    // No Content-Type header: the browser sets it with the multipart boundary.
    method: 'PATCH',
    path,
    token,
  })
  return toDocument(body, requestLabel('PATCH', path))
}

/**
 * Mints a short-lived file token (observed lifetime: 180 seconds) for the
 * current user. Fetch a fresh one per download, never store it.
 */
export async function getFileToken(baseUrl: string, token: string): Promise<string> {
  const body = await requestJson<{ token?: unknown }>({ baseUrl, method: 'POST', path: FILES_TOKEN_PATH, token })
  if (typeof body.token !== 'string' || body.token.length === 0) {
    throw new NostromoClientError(`${requestLabel('POST', FILES_TOKEN_PATH)} n'a renvoyé aucun jeton.`, {
      kind: 'auth',
    })
  }
  return body.token
}

/**
 * Downloads a protected document file. The file must travel in the query
 * string: an `Authorization` header alone returns 404, so there is no header
 * based fallback. The token is short-lived and is kept out of error messages.
 */
export async function downloadFile(baseUrl: string, fileToken: string, docId: string, filename: string): Promise<Blob> {
  const path = `${FILES_PATH}/${encodeURIComponent(docId)}/${encodeURIComponent(filename)}`
  const response = await send({ baseUrl, method: 'GET', path: `${path}${toQueryString({ token: fileToken })}` })
  return response.blob()
}

/** A random document id matching `^[a-z0-9]{15}$`, to be generated before the first push. */
export function generateDocId15(): string {
  const bytes = new Uint8Array(DOCUMENT_ID_LENGTH)
  crypto.getRandomValues(bytes)

  let id = ''
  for (const byte of bytes) {
    id += DOCUMENT_ID_ALPHABET[byte % DOCUMENT_ID_ALPHABET.length]
  }
  return id
}

/**
 * Deterministic document id of a player's photo.
 *
 * The photo document id must be derivable from the player id alone, identically
 * on every machine and after every restart: that is what makes a photo upload
 * idempotent (a retried create cannot duplicate a photo) and what removes the
 * need for an id map. Algorithm:
 *
 * 1. two independent 64-bit FNV-1a lanes (distinct salt and offset basis) hash
 *    the player id, giving 128 bits of spread: a single 64-bit lane would only
 *    fill 13 of the 15 base36 characters,
 * 2. the lanes are concatenated into one 128-bit value, reduced modulo 36^15
 *    (the size of the id space),
 * 3. the remainder is encoded in base 36 and left padded, which always yields
 *    15 characters of `[a-z0-9]`.
 *
 * No clock, storage or machine state is involved, and two distinct player ids
 * collide with probability about 2^-77.6.
 */
export function photoDocId(playerId: string): string {
  const primary = fnv1a64(`${PHOTO_ID_SALT_PRIMARY}:${playerId}`, FNV_OFFSET_PRIMARY)
  const secondary = fnv1a64(`${PHOTO_ID_SALT_SECONDARY}:${playerId}`, FNV_OFFSET_SECONDARY)
  const combined = primary * TWO_POW_64 + secondary

  return encodeBase36(combined % DOCUMENT_ID_SPACE, DOCUMENT_ID_LENGTH)
}

/**
 * Converts a timestamp to PocketBase's native filter layout
 * `YYYY-MM-DD HH:MM:SS.SSSZ`.
 *
 * The comparison is a plain text comparison against the stored string, so the
 * ISO `T` form returns 200 with zero rows, silently. Every filter this app
 * builds must go through here. A value already in the native layout (the
 * `updated` field ping-ponged back from a previous response) is kept as is.
 */
export function toPocketBaseTimestamp(value: Date | string): string {
  const iso = typeof value === 'string' ? value : value.toISOString()
  if (NATIVE_TIMESTAMP_PATTERN.test(iso)) {
    return iso
  }

  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) {
    throw new NostromoClientError('Impossible de construire un horodatage Nostromo à partir de la valeur fournie.', {
      kind: 'validation',
    })
  }
  return parsed.toISOString().replace('T', ' ')
}

/** Sends a request; throws `NostromoClientError` on transport failure or non-2xx status. */
async function send(options: NostromoRequestOptions): Promise<Response> {
  const { baseUrl, body, headers, method, path, token } = options
  const requestHeaders: Record<string, string> = { ...headers }
  if (token !== undefined) {
    // PocketBase accepts the raw token and also a `Bearer ` prefix: pick the raw
    // form and stay consistent (integration guide, 3.3).
    requestHeaders.Authorization = token
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl.replace(TRAILING_SLASHES, '')}${path}`, {
      body,
      headers: requestHeaders,
      method,
    })
  } catch (error) {
    throw new NostromoClientError(`${requestLabel(method, path)} a échoué : le serveur est injoignable.`, {
      cause: error,
      kind: 'network',
    })
  }

  if (!response.ok) {
    const error = await toResponseError(response, requestLabel(method, path))
    throw error
  }
  return response
}

/** Sends a request and parses its JSON body. */
async function requestJson<T>(options: NostromoRequestOptions): Promise<T> {
  const response = await send(options)
  return readJsonBody<T>(response, requestLabel(options.method, options.path))
}

async function readJsonBody<T>(response: Response, label: string): Promise<T> {
  try {
    return (await response.json()) as T
  } catch (error) {
    throw new NostromoClientError(`${label} a renvoyé un corps qui n'est pas du JSON valide.`, {
      cause: error,
      kind: 'unknown',
      status: response.status,
    })
  }
}

async function toResponseError(response: Response, label: string): Promise<NostromoClientError> {
  const detail = await readErrorMessage(response)
  const message = `${label} a échoué (${response.status}) : ${detail}`
  return new NostromoClientError(message, { kind: errorKindForStatus(response.status), status: response.status })
}

/** Reads `{message, status, data}` from an error body, falling back to the status text. */
async function readErrorMessage(response: Response): Promise<string> {
  const fallback = response.statusText.length > 0 ? response.statusText : 'aucun message fourni par le serveur'
  try {
    const body = (await response.json()) as { message?: unknown }
    return typeof body.message === 'string' && body.message.length > 0 ? body.message : fallback
  } catch {
    return fallback
  }
}

function errorKindForStatus(status: number): NostromoErrorKind {
  switch (status) {
    case 400:
      return 'validation'
    case 401:
      return 'auth'
    case 404:
      return 'notfound'
    case 409:
      return 'conflict'
    default:
      return 'unknown'
  }
}

/** `METHOD /path`, with the query string dropped: it can carry a short-lived file token. */
function requestLabel(method: NostromoMethod, path: string): string {
  const [pathname] = path.split('?')
  return `${method} ${pathname}`
}

function toQueryString(params: Record<string, number | string | undefined>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue
    }
    // encodeURIComponent keeps a space as %20, the exact form the guide verified
    // for a `updated>='...'` filter.
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return parts.length > 0 ? `?${parts.join(QUERY_SEPARATOR)}` : ''
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback
}

/** Turns a server record into a document, refusing anything without an id and a numeric version. */
function toDocument(data: unknown, label: string): NostromoDocument {
  const record = (data ?? {}) as RawRecord
  if (typeof record.id !== 'string' || typeof record.version !== 'number') {
    throw new NostromoClientError(`${label} n'a pas renvoyé de document avec un id et une version numérique.`, {
      kind: 'unknown',
    })
  }

  return {
    file: typeof record.file === 'string' && record.file.length > 0 ? record.file : undefined,
    id: record.id,
    owner: typeof record.owner === 'string' ? record.owner : '',
    payload: record.payload,
    updated: typeof record.updated === 'string' ? record.updated : '',
    version: record.version,
  }
}

function fnv1a64(input: string, offsetBasis: bigint): bigint {
  let hash = offsetBasis
  for (const character of input) {
    // biome-ignore lint/suspicious/noBitwiseOperators: XOR is the defining operation of FNV-1a; the wrap-around is an arithmetic modulo below.
    hash ^= BigInt(character.codePointAt(0) ?? 0)
    hash = (hash * FNV_PRIME_64) % TWO_POW_64
  }
  return hash
}

function encodeBase36(value: bigint, length: number): string {
  let remainder = value
  const characters: string[] = []
  for (let index = 0; index < length; index += 1) {
    characters.push(DOCUMENT_ID_ALPHABET[Number(remainder % DOCUMENT_ID_RADIX)])
    remainder /= DOCUMENT_ID_RADIX
  }
  return characters.reverse().join('')
}
