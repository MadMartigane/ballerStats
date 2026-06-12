import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAllPhotos, deletePhoto, getAllPhotoEntries, getPhoto, hasPhoto, storePhoto } from './photo-store'

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
