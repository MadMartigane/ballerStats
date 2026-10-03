import { describe, expect, it } from 'vitest'
import { computePlayTimes } from '../../stats/play-time'
import { AGE_CATEGORY_PRESETS, resolveMatchFormat } from '../../team/match-format'
import { U13_SAMPLE_MATCH } from '../fixtures/u13-sample-match'
import { seedRealMatchDataset } from './real-match.scenario'

/**
 * The only names allowed to appear in the fixture. The real identifiers are
 * deliberately NOT listed here: this file is committed, so it must itself never
 * carry a real name. The real-vs-pseudonym mapping lives only in the throwaway
 * generator under `.jcode-scratch/`.
 */
const EXPECTED_PSEUDONYMS = [
  { firstName: 'Léo', id: 'u13-p1', lastName: 'Martin' },
  { firstName: 'Hugo', id: 'u13-p2', lastName: 'Bernard' },
  { firstName: 'Noah', id: 'u13-p3', lastName: 'Dubois' },
  { firstName: 'Nathan', id: 'u13-p4', lastName: 'Moreau' },
  { firstName: 'Yanis', id: 'u13-p5', lastName: 'Girard' },
  { firstName: 'Ethan', id: 'u13-p6', lastName: 'Roux' },
  { firstName: 'Tom', id: 'u13-p7', lastName: 'Fournier' },
  { firstName: 'Enzo', id: 'u13-p8', lastName: 'Lambert' },
]

const DEMO_LICENSE_PATTERN = /^DEMO\d{4}$/
const REAL_LICENSE_PATTERN = /BC\d{6}|HDF\d{7}|JH\d{6}/
// French phone shape only: 13-digit event timestamps must not be mistaken for phone numbers.
const FRENCH_PHONE_PATTERN = /(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}/

/** Serialise every string reachable from the dataset for a whole-blob PII scan. */
function serialiseDataset(): string {
  const dataset = seedRealMatchDataset()
  const payload = {
    clubs: dataset.clubs.map((club) => club.getRawData()),
    contacts: dataset.contacts.map((contact) => contact.getRawData()),
    matchs: dataset.matchs.map((match) => match.getRawData()),
    players: dataset.players.map((player) => player.getRawData()),
    teams: dataset.teams.map((team) => team.getRawData()),
  }
  return JSON.stringify(payload)
}

describe('seedRealMatchDataset', () => {
  it('seeds an 8-player, single-team, single-locked-match dataset', () => {
    const dataset = seedRealMatchDataset()

    expect(dataset.players).toHaveLength(8)
    expect(dataset.teams).toHaveLength(1)
    expect(dataset.matchs).toHaveLength(1)
    expect(dataset.contacts).toHaveLength(0)

    for (const player of dataset.players) {
      expect(player.hasPhoto).toBe(false)
      expect(player.licenseNumber).toMatch(DEMO_LICENSE_PATTERN)
    }
  })

  it('carries the U13 category and resolves the preset, with no team override', () => {
    const [team] = seedRealMatchDataset().teams
    const raw = team.getRawData()

    expect(raw.category).toBe('U13')
    expect(raw.matchFormat).toBeUndefined()
    expect(resolveMatchFormat(raw).source).toBe('category-preset')
    expect(resolveMatchFormat(raw)).toEqual({ ...AGE_CATEGORY_PRESETS.U13, source: 'category-preset' })
    expect(raw.playerIds).toEqual([...U13_SAMPLE_MATCH.teamRosterIds])
  })

  it('locks the match and wires the roster to the fixture ids', () => {
    const [match] = seedRealMatchDataset().matchs
    const raw = match.getRawData()

    expect(raw.status).toBe('locked')
    expect(raw.teamId).toBe('team-u13')
    expect(raw.stats).toHaveLength(407)
    // Date is shifted one week from the real fixture so the demo never matches a real date.
    expect(raw.date).toBe('2026-09-12T15:30')
  })

  it('neutralises the club, team, opponent and championship identity', () => {
    const dataset = seedRealMatchDataset()
    const [club] = dataset.clubs
    const [team] = dataset.teams
    const [match] = dataset.matchs

    expect(club.getRawData()).toMatchObject({ licenseNumber: '0000000000', name: 'Club Démo' })
    expect(team.getRawData().name).toBe('Équipe Démo U13')
    expect(match.getRawData().opponent).toBe('Adversaires Démo')
    expect(match.getRawData().championship).toBe('Démo U13')
  })

  it('replays the real substitution stream shape', () => {
    const [match] = seedRealMatchDataset().matchs
    const stats = match.getRawData().stats ?? []

    const substitutionCount = stats.filter((entry) => entry.name === 'fiveIn' || entry.name === 'fiveOut').length
    const gameStopCount = stats.filter((entry) => entry.name === 'gameStop').length

    expect(substitutionCount).toBe(49)
    expect(gameStopCount).toBe(84)
  })
})

describe('fixture anonymisation', () => {
  it('offsets every event instant so no committed timestamp maps to a real match instant', () => {
    const [first] = U13_SAMPLE_MATCH.stats
    const iso = new Date(first.timestamp).toISOString()

    // The real first event decoded to 2026-09-20 18:27:25.329 UTC. The whole
    // stream is shifted 7 days earlier, so the committed instants are not real.
    expect(iso).toBe('2026-09-13T18:27:25.329Z')
    expect(iso.startsWith('2026-09-20')).toBe(false)
  })

  it('uses only the allowlisted pseudonyms', () => {
    expect(U13_SAMPLE_MATCH.players).toHaveLength(EXPECTED_PSEUDONYMS.length)

    for (const expected of EXPECTED_PSEUDONYMS) {
      const player = U13_SAMPLE_MATCH.players.find((candidate) => candidate.id === expected.id)
      expect(player, `missing fixture player ${expected.id}`).toBeDefined()
      expect(player?.firstName).toBe(expected.firstName)
      expect(player?.lastName).toBe(expected.lastName)
    }
  })

  it('contains no email address, phone number or real licence shape', () => {
    const payload = `${serialiseDataset()}${JSON.stringify(U13_SAMPLE_MATCH)}`

    expect(payload).not.toContain('@')
    expect(payload).not.toMatch(FRENCH_PHONE_PATTERN)
    expect(payload).not.toMatch(REAL_LICENSE_PATTERN)
  })
})

describe('computePlayTimes over the seeded real match', () => {
  const dataset = seedRealMatchDataset()
  const match = dataset.matchs[0].getRawData()
  const [team] = dataset.teams
  const format = resolveMatchFormat(team.getRawData())
  const result = computePlayTimes(match, format)

  it('measures the live interval union, dead-ball time excluded, inside the 4x8 tolerance', () => {
    // Anchor computed by running the real engine over the real event stream with
    // the `gameStop` dead-ball windows subtracted.
    expect(result.quality.eventsTotalMinutes).toBeCloseTo(163.49, 2)
    expect(result.deviationRatio).toBeCloseTo(0.021_811, 4)
    expect(result.renormalised).toBe(false)
  })

  it('keeps every player at the interval-union anchor, untouched by renormalisation', () => {
    const byPlayerId = new Map(result.entries.map((entry) => [entry.playerId, entry]))

    expect(result.entries).toHaveLength(8)
    for (const fixturePlayer of U13_SAMPLE_MATCH.players) {
      const entry = byPlayerId.get(fixturePlayer.id)
      expect(entry, `missing entry for ${fixturePlayer.id}`).toBeDefined()
      expect(entry?.rawMinutes).toBeCloseTo(fixturePlayer.expectedRawMinutes, 1)
      expect(entry?.minutes).toBeCloseTo(fixturePlayer.expectedPlayTime, 1)
    }
  })

  it('keeps every final value under the 32-minute ceiling and the total at the raw sum', () => {
    const total = result.entries.reduce((sum, entry) => sum + entry.minutes, 0)

    expect(total).toBeCloseTo(163.49, 1)
    for (const entry of result.entries) {
      expect(entry.minutes).toBeLessThanOrEqual(32)
    }
  })

  it('preserves the raw ranking and leaves every final value equal to its raw value', () => {
    const byRaw = [...result.entries].sort((left, right) => right.rawMinutes - left.rawMinutes).map((e) => e.playerId)
    const byFinal = [...result.entries].sort((left, right) => right.minutes - left.minutes).map((e) => e.playerId)

    expect(byFinal).toEqual(byRaw)

    const busiest = result.entries.find((entry) => entry.playerId === 'u13-p3')
    expect(busiest?.rawMinutes).toBeCloseTo(29.71, 1)
    expect(busiest?.minutes).toBeCloseTo(29.71, 1)
    expect(busiest?.source).toBe('computed')
  })
})
