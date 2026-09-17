import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markCollectionDirty } from './nostromo/dirty-marks'
import { getTitles, persistTitles, titles, updateTitle } from './trombi-titles-store'

/**
 * The titles store had no suite of its own: this one covers the single thing it
 * owes the sync layer, the dirty mark of its persist funnel. The mark itself
 * (debounce, outbox, status) is tested in
 * `src/libs/nostromo/push-engine.test.ts`.
 */
vi.mock('./nostromo/dirty-marks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./nostromo/dirty-marks')>()
  return {
    ...actual,
    markCollectionDirty: vi.fn(),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('trombi-titles-store dirty marks', () => {
  it('marks the trombiTitles unit dirty after the titles were persisted', async () => {
    await updateTitle('teamName', 'Les Lions')

    expect(titles.teamName).toBe('Les Lions')
    expect(markCollectionDirty).toHaveBeenCalledTimes(1)
    expect(markCollectionDirty).toHaveBeenCalledWith('trombiTitles')

    await persistTitles({ teamName: 'Les Tigres' })

    expect(markCollectionDirty).toHaveBeenCalledTimes(2)
    expect(markCollectionDirty).toHaveBeenCalledWith('trombiTitles')
  })
})

describe('trombi-titles-store clone getter', () => {
  it('getTitles() returns a clone: mutating the result never affects the store', async () => {
    await persistTitles({ teamName: 'Les Lions' })

    const read = getTitles()
    read.teamName = 'mutated'

    expect(read.teamName).toBe('mutated')
    expect(getTitles().teamName).toBe('Les Lions')
    expect(titles.teamName).toBe('Les Lions')
  })
})
