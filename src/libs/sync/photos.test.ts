import { describe, expect, it } from 'vitest'
import { shouldDownloadPhoto, shouldUploadPhoto } from './photos'

describe('shouldUploadPhoto', () => {
  it('uploads a new/edited local photo whose snapshot flag was missing', () => {
    expect(shouldUploadPhoto({ localHasBlob: true, localHasPhoto: true, snapshotHasPhoto: false })).toBe(true)
  })

  it('does not re-upload when the snapshot already tracked the photo', () => {
    expect(shouldUploadPhoto({ localHasBlob: true, localHasPhoto: true, snapshotHasPhoto: true })).toBe(false)
  })

  it('does not upload when the blob or the flag is missing', () => {
    expect(shouldUploadPhoto({ localHasBlob: false, localHasPhoto: true, snapshotHasPhoto: false })).toBe(false)
    expect(shouldUploadPhoto({ localHasBlob: true, localHasPhoto: false, snapshotHasPhoto: false })).toBe(false)
  })
})

describe('shouldDownloadPhoto', () => {
  it('downloads when the remote advertises a photo the local store lacks', () => {
    expect(shouldDownloadPhoto({ localHasBlob: false, remoteHasPhoto: true })).toBe(true)
  })

  it('skips when a local blob exists or the remote has no photo', () => {
    expect(shouldDownloadPhoto({ localHasBlob: true, remoteHasPhoto: true })).toBe(false)
    expect(shouldDownloadPhoto({ localHasBlob: false, remoteHasPhoto: false })).toBe(false)
  })
})
