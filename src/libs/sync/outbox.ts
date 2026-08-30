import { clear, del, entries, get, set } from 'idb-keyval'
import { outboxStore } from './idb'
import type { OutboxItem, SyncCollection } from './sync.d'

export function outboxKey(collection: SyncCollection, id: string): string {
  return `${collection}:${id}`
}

/** Queue a pending mutation, replacing any previous pending item for the same record. */
export async function enqueueOutboxItem(item: OutboxItem): Promise<void> {
  const key = outboxKey(item.collection, item.id)
  const existing = await get<OutboxItem>(key, outboxStore)
  if (existing) {
    // Keep the original attempts counter so unmigratable items are not reset.
    await set(
      key,
      {
        ...existing,
        attempts: existing.attempts,
        id: item.id,
        photoPending: item.photoPending,
        updatedAt: item.updatedAt,
      },
      outboxStore
    )
    return
  }
  await set(key, item, outboxStore)
}

export function getOutboxItem(collection: SyncCollection, id: string): Promise<OutboxItem | undefined> {
  return get<OutboxItem>(outboxKey(collection, id), outboxStore)
}

export async function removeOutboxItem(collection: SyncCollection, id: string): Promise<void> {
  await del(outboxKey(collection, id), outboxStore)
}

/** Bumps the attempts counter of a still-pending item (permanent 400s drop after 5). */
export async function setOutboxAttempts(collection: SyncCollection, id: string, attempts: number): Promise<void> {
  const existing = await getOutboxItem(collection, id)
  if (!existing) {
    return
  }
  await set(outboxKey(collection, id), { ...existing, attempts }, outboxStore)
}

export async function clearOutbox(): Promise<void> {
  await clear(outboxStore)
}

export async function getAllOutboxItems(): Promise<OutboxItem[]> {
  const allEntries = await entries<string, OutboxItem>(outboxStore)
  return allEntries.map(([, item]) => item).sort((a, b) => a.createdAt - b.createdAt || a.updatedAt - b.updatedAt)
}
