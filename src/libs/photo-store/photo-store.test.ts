import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markPhotoDirty } from '../nostromo/dirty-marks'
import { clearAllPhotos, deletePhoto, getAllPhotoEntries, getPhoto, hasPhoto, storePhoto } from './photo-store'

/**
 * The sync side effect of a photo write is asserted here through a mock: the
 * mark itself has its own suite (`src/libs/nostromo/push-engine.test.ts`).
 */
vi.mock('../nostromo/dirty-marks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../nostromo/dirty-marks')>()
  return {
    ...actual,
    markPhotoDirty: vi.fn(),
  }
})

beforeEach(async () => {
  await clearAllPhotos()
})

afterEach(async () => {
  await clearAllPhotos()
})

describe('photo-store', () => {
  it('stores and retrieves a photo blob', async () => {
    const blob = new Blob(['test-image-data'], { type: 'image/webp' })
    await storePhoto('player-1', blob)
    const retrieved = await getPhoto('player-1')
    expect(retrieved).toBeDefined()
  })

  it('returns undefined for non-existent photo', async () => {
    const retrieved = await getPhoto('non-existent')
    expect(retrieved).toBeUndefined()
  })

  it('deletes a stored photo', async () => {
    const blob = new Blob(['test-data'], { type: 'image/webp' })
    await storePhoto('player-2', blob)
    await deletePhoto('player-2')
    const retrieved = await getPhoto('player-2')
    expect(retrieved).toBeUndefined()
  })

  it('reports hasPhoto correctly', async () => {
    expect(await hasPhoto('player-3')).toBe(false)
    await storePhoto('player-3', new Blob(['data'], { type: 'image/webp' }))
    expect(await hasPhoto('player-3')).toBe(true)
    await deletePhoto('player-3')
    expect(await hasPhoto('player-3')).toBe(false)
  })

  it('clears all photos', async () => {
    await storePhoto('player-4', new Blob(['data1'], { type: 'image/webp' }))
    await storePhoto('player-5', new Blob(['data2'], { type: 'image/webp' }))
    await storePhoto('player-6', new Blob(['data3'], { type: 'image/webp' }))
    await clearAllPhotos()
    expect(await hasPhoto('player-4')).toBe(false)
    expect(await hasPhoto('player-5')).toBe(false)
    expect(await hasPhoto('player-6')).toBe(false)
  })

  it('gets all photo entries', async () => {
    await storePhoto('player-7', new Blob(['data-a'], { type: 'image/webp' }))
    await storePhoto('player-8', new Blob(['data-b'], { type: 'image/webp' }))
    const entries = await getAllPhotoEntries()
    expect(entries.length).toBe(2)
    const playerIds = entries.map((e) => e.playerId).sort()
    expect(playerIds).toEqual(['player-7', 'player-8'])
  })

  it('getAllPhotoEntries returns empty array when no photos', async () => {
    const entries = await getAllPhotoEntries()
    expect(entries).toEqual([])
  })
})

describe('photo-store dirty marks', () => {
  it('marks the photo unit dirty on store and on delete', async () => {
    const mark = vi.mocked(markPhotoDirty)
    mark.mockClear()

    await storePhoto('player-9', new Blob(['data'], { type: 'image/webp' }))
    expect(mark).toHaveBeenCalledTimes(1)
    expect(mark).toHaveBeenCalledWith('player-9')

    await deletePhoto('player-9')
    expect(mark).toHaveBeenCalledTimes(2)
    expect(mark).toHaveBeenCalledWith('player-9')
  })

  it('marks every cleared photo unit dirty on clearAllPhotos', async () => {
    const mark = vi.mocked(markPhotoDirty)
    await storePhoto('player-10', new Blob(['data-a'], { type: 'image/webp' }))
    await storePhoto('player-11', new Blob(['data-b'], { type: 'image/webp' }))
    mark.mockClear()

    await clearAllPhotos()

    expect(mark).toHaveBeenCalledTimes(2)
    expect(mark.mock.calls.map((call) => call[0]).sort()).toEqual(['player-10', 'player-11'])
  })

  it('marks nothing on clearAllPhotos when the store is empty', async () => {
    const mark = vi.mocked(markPhotoDirty)
    mark.mockClear()

    await clearAllPhotos()

    expect(mark).not.toHaveBeenCalled()
  })
})
