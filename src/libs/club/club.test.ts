import { describe, expect, it } from 'vitest'
import Club, { CLUB_LICENSE_MAX_LENGTH } from './club'
import type { ClubRawData } from './club.d'

describe('CLUB_LICENSE_MAX_LENGTH', () => {
  it('is 12 characters', () => {
    expect(CLUB_LICENSE_MAX_LENGTH).toBe(12)
  })
})

describe('Club', () => {
  it('generates a unique id when none is provided', () => {
    const a = new Club()
    const b = new Club()
    expect(a.id).toBeTruthy()
    expect(a.id).not.toBe(b.id)
  })

  it('keeps the provided id and fields', () => {
    const club = new Club({ id: 'club-1', licenseNumber: '1310000000', name: 'BCC Marseille' })
    expect(club.id).toBe('club-1')
    expect(club.name).toBe('BCC Marseille')
    expect(club.licenseNumber).toBe('1310000000')
  })

  it('is registerable only when named', () => {
    expect(new Club({ name: 'BCC Marseille' }).isRegisterable).toBe(true)
    expect(new Club().isRegisterable).toBe(false)
  })

  it('getRawData() round-trips through the constructor', () => {
    const raw: ClubRawData = { id: 'club-1', licenseNumber: 'ABC', name: 'Club' }
    expect(new Club(raw).getRawData()).toEqual(raw)
  })

  it('getRawData() omits empty optional fields', () => {
    const club = new Club({ id: 'club-1' })
    expect(club.getRawData()).toEqual({ id: 'club-1' })
  })

  it('update() merges over the existing data', () => {
    const club = new Club({ id: 'club-1', name: 'Old' })
    club.update({ licenseNumber: '99' })
    expect(club.name).toBe('Old')
    expect(club.licenseNumber).toBe('99')
  })
})
