import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearOutbox,
  enqueueOutboxItem,
  getAllOutboxItems,
  getOutboxItem,
  removeOutboxItem,
  setOutboxAttempts,
} from './outbox'
import type { OutboxItem } from './sync.d'

function item(collection: 'players' | 'teams', id: string, createdAt: number): OutboxItem {
  return {
    attempts: 0,
    collection,
    createdAt,
    id,
    updatedAt: createdAt,
  }
}

beforeEach(async () => {
  await clearOutbox()
})

describe('outbox', () => {
  it('returns queued items first-in first-out', async () => {
    await enqueueOutboxItem(item('teams', 't1', 2))
    await enqueueOutboxItem(item('players', 'p1', 1))
    const all = await getAllOutboxItems()
    expect(all.map((entry) => entry.id)).toEqual(['p1', 't1'])
  })

  it('dedupes by collection + id and keeps the latest pending flags', async () => {
    const first = item('players', 'p1', 10)
    await enqueueOutboxItem(first)
    const second = item('players', 'p1', 20)
    second.photoPending = true
    await enqueueOutboxItem(second)
    const all = await getAllOutboxItems()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ id: 'p1', photoPending: true, updatedAt: 20 })
  })

  it('keeps the original attempts counter when re-enqueued', async () => {
    const first = item('players', 'p1', 1)
    first.attempts = 3
    await enqueueOutboxItem(first)
    await setOutboxAttempts('players', 'p1', 4)
    await enqueueOutboxItem(item('players', 'p1', 2))
    const stored = await getOutboxItem('players', 'p1')
    expect(stored?.attempts).toBe(4)
  })

  it('removes single items and clears the whole queue', async () => {
    await enqueueOutboxItem(item('players', 'p1', 1))
    await enqueueOutboxItem(item('teams', 't1', 2))
    await removeOutboxItem('players', 'p1')
    expect((await getAllOutboxItems()).map((entry) => entry.id)).toEqual(['t1'])
    await clearOutbox()
    expect(await getAllOutboxItems()).toEqual([])
  })
})
