import { describe, expect, it, vi } from 'vitest'
import Club from '../club/club'
import type { ClubRawData } from '../club/club.d'
import bsEventBus from '../event-bus/event-bus'
import Clubs from './clubs'

const NOT_REGISTERABLE_PATTERN = /not registerable/
const ALREADY_EXISTS_PATTERN = /already exist/
const DOES_NOT_EXIST_PATTERN = /doesn't exist/
const NOT_FOUND_PATTERN = /not found/

function makeClubData(overrides: Partial<ClubRawData> = {}): ClubRawData {
  return {
    id: 'c1',
    name: 'BCC Marseille',
    ...overrides,
  }
}

describe('Clubs', () => {
  it('add() stores the club and fires a change event', () => {
    const clubs = new Clubs()
    const handler = vi.fn()
    bsEventBus.addEventListener('BS::CLUBS::CHANGE', handler)

    clubs.add(new Club(makeClubData()))

    expect(clubs.length).toBe(1)
    expect(handler).toHaveBeenCalledTimes(1)
    bsEventBus.removeEventListener('BS::CLUBS::CHANGE', handler)
  })

  it('add() throws for a duplicate id', () => {
    const clubs = new Clubs()
    clubs.add(new Club(makeClubData()))
    const duplicate = new Club(makeClubData({ name: 'Autre club' }))

    expect(() => clubs.add(duplicate)).toThrow(ALREADY_EXISTS_PATTERN)
  })

  it('add() rejects an unnamed club', () => {
    const clubs = new Clubs()
    const nameless = new Club(makeClubData({ name: '' }))

    expect(() => clubs.add(nameless)).toThrow(NOT_REGISTERABLE_PATTERN)
  })

  it('updateClub() updates an existing club', () => {
    const clubs = new Clubs()
    clubs.add(new Club(makeClubData({ name: 'Old' })))

    clubs.updateClub(new Club(makeClubData({ licenseNumber: '99', name: 'New' })))

    expect(clubs.clubs[0].name).toBe('New')
    expect(clubs.clubs[0].licenseNumber).toBe('99')
  })

  it('updateClub() throws for a non-existent id', () => {
    const clubs = new Clubs()
    const ghost = new Club(makeClubData({ id: 'ghost' }))

    expect(() => clubs.updateClub(ghost)).toThrow(DOES_NOT_EXIST_PATTERN)
  })

  it('remove() removes the club from the collection', () => {
    const clubs = new Clubs([makeClubData({ id: 'c1' }), makeClubData({ id: 'c2', name: 'Autre' })])
    clubs.remove(new Club({ id: 'c1' }))

    expect(clubs.length).toBe(1)
    expect(clubs.clubs[0].id).toBe('c2')
  })

  it('remove() throws for a non-existent id', () => {
    const clubs = new Clubs()
    const ghost = new Club(makeClubData({ id: 'ghost' }))

    expect(() => clubs.remove(ghost)).toThrow(NOT_FOUND_PATTERN)
  })

  it('clubs getter returns deep clones (mutating returned clubs does not affect internal state)', () => {
    const clubs = new Clubs([makeClubData()])

    const [retrieved] = clubs.clubs
    retrieved.update({ name: 'Mutated' })

    expect(clubs.clubs[0].name).toBe('BCC Marseille')
  })

  it('setFromRawData(null) empties the collection', () => {
    const clubs = new Clubs([makeClubData()])
    expect(clubs.length).toBe(1)

    clubs.setFromRawData(null as unknown as ClubRawData[])

    expect(clubs.length).toBe(0)
  })
})
