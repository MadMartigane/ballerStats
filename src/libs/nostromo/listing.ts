/**
 * Paginated listing of the remote documents, shared by every Nostromo reader
 * (restore plan, import orphan cleanup, remote snapshot).
 *
 * `listDocuments` only ever returns what the authenticated account may read, so
 * a listing is the rights discovery mechanism this app relies on. No filter is
 * used: a document the caller does not recognize is ignored by the consumer, not
 * by this module.
 */
import { listDocuments } from './client'
import type { NostromoDocument } from './client.d'
import type { NostromoConfig } from './nostromo-config-store.d'
import { pushNostromoLog } from './nostromo-sync-store'

/** Page size of the listing: the server maximum, one round trip per 500 documents. */
const LISTING_PAGE_SIZE = 500

/** Safety bound of the listing loop: 100 pages, 50 000 documents, far above any real account. */
const LISTING_MAX_PAGES = 100

/**
 * Lists every document the caller may read, one page at a time. A page is only
 * requested once the previous page told how many pages the listing holds; past
 * `LISTING_MAX_PAGES` the listing stops and says so instead of looping forever.
 */
export async function listAllRemoteDocuments(config: NostromoConfig): Promise<NostromoDocument[]> {
  const documents: NostromoDocument[] = []
  let lastPageReached = false

  for (let page = 1; page <= LISTING_MAX_PAGES; page += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: a page is only requested once the previous page told how many pages the listing holds.
    const result = await listDocuments(config.baseUrl, config.token, { page, perPage: LISTING_PAGE_SIZE })
    documents.push(...result.items)

    const pageCount = Math.ceil(result.totalItems / LISTING_PAGE_SIZE)
    if (result.items.length === 0 || page >= pageCount || result.items.length < LISTING_PAGE_SIZE) {
      lastPageReached = true
      break
    }
  }

  if (!lastPageReached) {
    pushNostromoLog(
      'warn',
      `Nostromo : le listage s'est arrêté après ${LISTING_MAX_PAGES} pages ; les documents suivants sont ignorés.`
    )
  }
  return documents
}
