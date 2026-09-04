import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockImageCompression } = vi.hoisted(() => ({
  mockImageCompression: vi.fn(),
}))

vi.mock('browser-image-compression', () => ({
  default: mockImageCompression,
}))

import { compressPhoto } from './photo-compressor'

const MOCK_WEBP_BLOB = new Blob(['compressed-webp-data'], { type: 'image/webp' })

afterEach(() => {
  vi.clearAllMocks()
})

describe('photo-compressor', () => {
  it('calls browser-image-compression with correct options', async () => {
    mockImageCompression.mockResolvedValue(MOCK_WEBP_BLOB)

    const file = new File(['raw-image'], 'photo.jpg', { type: 'image/jpeg' })
    const result = await compressPhoto(file)

    expect(mockImageCompression).toHaveBeenCalledOnce()
    expect(mockImageCompression).toHaveBeenCalledWith(file, {
      fileType: 'image/webp',
      maxSizeMB: 0.1,
      maxWidthOrHeight: 400,
      useWebWorker: true,
    })
    expect(result).toBe(MOCK_WEBP_BLOB)
  })

  it('returns a Blob with image/webp type', async () => {
    mockImageCompression.mockResolvedValue(MOCK_WEBP_BLOB)

    const file = new File(['raw'], 'photo.png', { type: 'image/png' })
    const result = await compressPhoto(file)

    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('image/webp')
  })

  it('propagates errors from the compression library', async () => {
    mockImageCompression.mockRejectedValue(new Error('Compression failed'))

    const file = new File(['raw'], 'photo.jpg', { type: 'image/jpeg' })

    await expect(compressPhoto(file)).rejects.toThrow('Compression failed')
  })
})
