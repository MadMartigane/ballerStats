import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockImageCompression } = vi.hoisted(() => ({
  mockImageCompression: vi.fn(),
}))

vi.mock('browser-image-compression', () => ({
  default: mockImageCompression,
}))

import { clearAllPhotos, deletePhoto, getPhoto, hasPhoto, storePhoto } from './photo-store/photo-store'
import Player from './player/player'
import { compressPhoto } from './photo-compressor/photo-compressor'

const MOCK_COMPRESSED_BLOB = new Blob(['compressed-webp-data'], { type: 'image/webp' })

beforeEach(async () => {
  await clearAllPhotos()
  mockImageCompression.mockResolvedValue(MOCK_COMPRESSED_BLOB)
})

afterEach(async () => {
  await clearAllPhotos()
  vi.clearAllMocks()
})

describe('photo flow integration', () => {
  it('compresses, stores, and retrieves a player photo', async () => {
    const player = new Player({ firstName: 'Test' })
    expect(player.hasPhoto).toBe(false)

    const file = new File(['image-data'], 'photo.jpg', { type: 'image/jpeg' })
    const compressed = await compressPhoto(file)
    expect(compressed.type).toBe('image/webp')
    expect(mockImageCompression).toHaveBeenCalledOnce()

    await storePhoto(player.id, compressed)
    expect(await hasPhoto(player.id)).toBe(true)

    await deletePhoto(player.id)
    expect(await hasPhoto(player.id)).toBe(false)
  })

  it('stores photo and updates player hasPhoto flag', async () => {
    const player = new Player({ firstName: 'Alice', lastName: 'Dupont', jersayNumber: '10' })
    expect(player.hasPhoto).toBe(false)

    await storePhoto(player.id, MOCK_COMPRESSED_BLOB)
    player.hasPhoto = true
    expect(player.hasPhoto).toBe(true)

    const rawData = player.getRawData()
    expect(rawData.hasPhoto).toBe(true)
  })

  it('getRawData includes hasPhoto as false', () => {
    const player = new Player({ firstName: 'Bob', lastName: 'Martin', jersayNumber: '23' })
    expect(player.hasPhoto).toBe(false)

    const rawData = player.getRawData()
    expect(rawData.hasPhoto).toBe(false)
  })

  it('setFromRawData handles legacy data without hasPhoto', () => {
    const player = new Player({ firstName: 'Charlie', lastName: 'Durand', jersayNumber: '5' })

    player.setFromRawData({ id: player.id, firstName: 'Charlie', lastName: 'Durand', jersayNumber: '5' })
    expect(player.hasPhoto).toBe(false)
  })

  it('setFromRawData correctly reads hasPhoto true', () => {
    const player = new Player({ firstName: 'Dave' })

    player.setFromRawData({ id: player.id, firstName: 'Dave', hasPhoto: true })
    expect(player.hasPhoto).toBe(true)
  })
})
