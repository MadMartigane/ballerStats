import { describe, expect, it } from 'vitest'
import type { ClubRawData } from './club.d'
import { migrateClubData } from './club-migration'

const CLUB_ID = 'club-1'
const PLAYER_WITH_CLUB = { clubId: CLUB_ID, id: 'p1' }
const PLAYER_WITHOUT_CLUB = { id: 'p2' }
const TEAM_WITH_CLUB = { clubId: CLUB_ID, id: 't1' }
const TEAM_WITHOUT_CLUB = { id: 't2' }

describe('migrateClubData', () => {
  it('creates a club from the legacy clubName (startup + old-format import)', () => {
    const result = migrateClubData({
      clubs: [],
      players: [PLAYER_WITHOUT_CLUB],
      teams: [TEAM_WITHOUT_CLUB],
      trombiTitles: { clubName: 'BCC Marseille', teamName: 'Les Aigles' },
    })

    expect(result.changed).toBe(true)
    expect(result.clubs).toHaveLength(1)
    expect(result.clubs[0].name).toBe('BCC Marseille')
    expect(result.clubs[0].id).toBeTruthy()
    expect(result.players[0].clubId).toBe(result.clubs[0].id)
    expect(result.teams[0].clubId).toBe(result.clubs[0].id)
    expect(result.trombiTitles).toEqual({ teamName: 'Les Aigles' })
    expect(result.trombiTitles).not.toHaveProperty('clubName')
  })

  it('creates a nameless default club when nothing exists (fresh install)', () => {
    const result = migrateClubData({ clubs: [], players: [], teams: [], trombiTitles: { teamName: '' } })

    expect(result.changed).toBe(true)
    expect(result.clubs).toHaveLength(1)
    expect(result.clubs[0].name).toBe('')
    expect(result.clubs[0].id).toBeTruthy()
    expect(result.trombiTitles).toEqual({ teamName: '' })
  })

  it('is a no-op when the data is already migrated', () => {
    const clubs: ClubRawData[] = [{ id: CLUB_ID, name: 'BCC Marseille' }]
    const result = migrateClubData({
      clubs,
      players: [PLAYER_WITH_CLUB],
      teams: [TEAM_WITH_CLUB],
      trombiTitles: { teamName: 'Les Aigles' },
    })

    expect(result.changed).toBe(false)
    expect(result.clubs).toEqual(clubs)
    expect(result.players).toEqual([PLAYER_WITH_CLUB])
    expect(result.teams).toEqual([TEAM_WITH_CLUB])
    expect(result.trombiTitles).toEqual({ teamName: 'Les Aigles' })
  })

  it('attaches an existing club to players/teams that miss the clubId', () => {
    const result = migrateClubData({
      clubs: [{ id: CLUB_ID, name: 'BCC Marseille' }],
      players: [PLAYER_WITH_CLUB, PLAYER_WITHOUT_CLUB],
      teams: [TEAM_WITHOUT_CLUB],
      trombiTitles: { teamName: 'Les Aigles' },
    })

    expect(result.changed).toBe(true)
    expect(result.players[0]).toEqual(PLAYER_WITH_CLUB)
    expect(result.players[1]).toEqual({ clubId: CLUB_ID, id: 'p2' })
    expect(result.teams[0]).toEqual({ clubId: CLUB_ID, id: 't2' })
  })

  it('migrates an old-format import (no clubs collection, legacy titles)', () => {
    const result = migrateClubData({
      clubs: undefined,
      players: [{ id: 'p1', licenseNumber: '1310000101' }],
      teams: [{ id: 'team-a', name: 'Les Aigles' }],
      trombiTitles: { clubName: 'Ancien Club', teamName: 'Les Aigles' },
    })

    expect(result.changed).toBe(true)
    const [club] = result.clubs
    expect(club.name).toBe('Ancien Club')
    expect(result.players[0].clubId).toBe(club.id)
    expect(result.teams[0].clubId).toBe(club.id)
    expect(result.trombiTitles).toEqual({ teamName: 'Les Aigles' })
  })

  it('gives an id to a stored club that lacks one', () => {
    const result = migrateClubData({
      clubs: [{ name: 'BCC Marseille' }],
      trombiTitles: { teamName: 'Les Aigles' },
    })

    expect(result.changed).toBe(true)
    expect(result.clubs[0].id).toBeTruthy()
    expect(result.clubs[0].name).toBe('BCC Marseille')
  })
})
