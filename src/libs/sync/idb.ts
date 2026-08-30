import type { UseStore } from 'idb-keyval'

export const SYNC_IDB_DB_NAME = 'baller-stats-db'
export const PHOTOS_STORE_NAME = 'photos'
export const OUTBOX_STORE_NAME = 'bs-outbox'
export const SYNC_META_STORE_NAME = 'bs-sync-meta'

// idb-keyval's createStore() cannot grow the schema of an existing database,
// so the app-wide stores (photos + outbox + sync meta) share one helper that
// creates every store when the database is first opened.
const REQUIRED_STORES = [PHOTOS_STORE_NAME, OUTBOX_STORE_NAME, SYNC_META_STORE_NAME]

// An upgrade can be blocked while another connection (e.g. an old idb-keyval
// photo connection) is still open; after MAX upgrade attempts we give up so the
// page never hangs waiting for a version change.
const MAX_UPGRADE_ATTEMPTS = 6
const UPGRADE_RETRY_MS = 250
const OPEN_TIMEOUT_MS = 2000

const BLOCKED_ERROR_PREFIX = 'indexedDB open blocked'

let sharedDbPromise: Promise<IDBDatabase> | null = null

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isBlockedError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith(BLOCKED_ERROR_PREFIX)
}

function openDatabase(version?: number): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(SYNC_IDB_DB_NAME) : indexedDB.open(SYNC_IDB_DB_NAME, version)
    let settled = false
    const timeout = setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      reject(new Error(`${BLOCKED_ERROR_PREFIX} (${SYNC_IDB_DB_NAME}${version === undefined ? '' : ` v${version}`})`))
    }, OPEN_TIMEOUT_MS)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const storeName of REQUIRED_STORES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName)
        }
      }
    }
    request.onsuccess = () => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        resolve(request.result)
      }
    }
    request.onerror = () => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        reject(request.error ?? new Error(`indexedDB open failed (${SYNC_IDB_DB_NAME})`))
      }
    }
  })
}

async function ensureUpgraded(db: IDBDatabase, attempts: number): Promise<IDBDatabase> {
  if (REQUIRED_STORES.every((storeName) => db.objectStoreNames.contains(storeName))) {
    return db
  }
  if (attempts >= MAX_UPGRADE_ATTEMPTS) {
    throw new Error(`indexedDB schema upgrade blocked after ${attempts} attempts (${SYNC_IDB_DB_NAME})`)
  }
  const nextVersion = db.version + 1
  db.close()
  try {
    return await ensureUpgraded(await openDatabase(nextVersion), attempts + 1)
  } catch (err) {
    if (!isBlockedError(err)) {
      throw err
    }
    // Another connection is holding the database; back off, re-read the current
    // version and bump again.
    await sleep(UPGRADE_RETRY_MS * (attempts + 1))
    return ensureUpgraded(await openDatabase(), attempts + 1)
  }
}

async function ensureSharedDb(): Promise<IDBDatabase> {
  return ensureUpgraded(await openDatabase(), 0)
}

function getSharedDb(): Promise<IDBDatabase> {
  if (!sharedDbPromise) {
    sharedDbPromise = ensureSharedDb()
  }
  return sharedDbPromise
}

/** idb-keyval-compatible store tuple backed by the shared schema. */
export function makeSharedStore(storeName: string): UseStore {
  return <T>(txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => T | PromiseLike<T>): Promise<T> =>
    getSharedDb().then((db) => {
      const transaction = db.transaction(storeName, txMode)
      return Promise.resolve(callback(transaction.objectStore(storeName)))
    })
}

export const outboxStore: UseStore = makeSharedStore(OUTBOX_STORE_NAME)
export const syncMetaStore: UseStore = makeSharedStore(SYNC_META_STORE_NAME)
