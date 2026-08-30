import { describe, expect, it } from 'vitest'
import type { PlayerRawData } from '../player/player.d'
import type { TeamRawData } from '../team/team.d'
import {
  buildOutboxDiffs,
  computeWinners,
  deepEqual,
  firstSyncDecision,
  fromContactRecord,
  fromMatchRecord,
  fromPlayerRecord,
  fromTeamRecord,
  isPbId,
  toContactPayload,
  toMatchPayload,
  toPlayerPayload,
  toTeamPayload,
} from './mapper'
import type { RemoteRecord, SyncCollection } from './sync.d'

const CLUB_ID = 'club00000000001'
const PLAYER_ID = 'player000000001'
const TEAM_ID = 'team00000000001'

describe('isPbId', () => {
  it('accepts 15-char lowercase alphanumeric ids', () => {
    expect(isPbId('abc123def456ghi')).toBe(true)
    expect(isPbId('explicit0000001')).toBe(true)
  })

  it('rejects legacy numeric-string and malformed ids', () => {
    expect(isPbId('42')).toBe(false)
    expect(isPbId('')).toBe(false)
    expect(isPbId('ABC123DEF456GHI')).toBe(false)
    expect(isPbId('abc123def456ghij')).toBe(false)
    expect(isPbId(undefined)).toBe(false)
  })
})

describe('toPlayerPayload', () => {
  it('injects the club and normalizes server fields', () => {
    const payload = toPlayerPayload(
      { birthDay: 1_700_000_000_000, firstName: 'John', jerseyNumber: '00', lastName: 'Roe' },
      CLUB_ID
    )
    expect(payload).toMatchObject({
      birthDay: String(1_700_000_000_000),
      club: CLUB_ID,
      deletedAt: 0,
      firstName: 'John',
      hasPhoto: false,
      jerseyNumber: '00',
      lastName: 'Roe',
      updatedAt: 0,
    })
  })

  it('sends live records as deletedAt 0 and tombstones as the stored value', () => {
    expect(toPlayerPayload({ id: 'x' }, CLUB_ID).deletedAt).toBe(0)
    expect(toPlayerPayload({ deletedAt: 42, id: 'x' }, CLUB_ID).deletedAt).toBe(42)
  })

  it('omits empty optional fields and attaches teamIds for staff creates', () => {
    const payload = toPlayerPayload({ id: 'x' }, CLUB_ID, [TEAM_ID])
    expect(payload.firstName).toBeUndefined()
    expect(payload).toMatchObject({ hasPhoto: false, teamIds: [TEAM_ID] })
  })
})

describe('toTeamPayload', () => {
  it('maps playerIds through the player id map and injects club', () => {
    const payload = toTeamPayload({ name: 'Équipe 1', playerIds: ['legacy-1', PLAYER_ID] }, CLUB_ID, {
      'legacy-1': 'newplayer0000001',
    })
    expect(payload).toMatchObject({
      club: CLUB_ID,
      deletedAt: 0,
      name: 'Équipe 1',
      playerIds: ['newplayer0000001', PLAYER_ID],
      updatedAt: 0,
    })
  })
})

describe('toMatchPayload', () => {
  it('resolves the client teamId into the server team relation', () => {
    const payload = toMatchPayload(
      { opponent: 'Les Bleus', teamId: 'legacy-team', type: 'home' },
      CLUB_ID,
      { 'legacy-team': TEAM_ID },
      {}
    ) as Record<string, unknown>
    expect(payload.team).toBe(TEAM_ID)
    expect(payload.club).toBe(CLUB_ID)
    expect(payload.playersInTheFive).toEqual([])
    expect(payload.stats).toEqual([])
    expect(payload.status).toBe('unlocked')
  })

  it('maps playersInTheFive and stats[].playerId through the player id map', () => {
    const payload = toMatchPayload(
      {
        opponent: 'Les Bleus',
        playersInTheFive: ['legacy-p1', 'legacy-p2'],
        stats: [
          { name: '2pts', playerId: 'legacy-p1', timestamp: 1, type: 'success', value: 2 },
          { name: 'assist', playerId: null, timestamp: 2, type: 'secondary', value: 1 },
        ],
        teamId: 'legacy-team',
      },
      CLUB_ID,
      { 'legacy-team': TEAM_ID },
      { 'legacy-p1': PLAYER_ID }
    ) as {
      playersInTheFive: string[]
      stats: Array<{ playerId: string | null }>
    }
    expect(payload.playersInTheFive).toEqual([PLAYER_ID, 'legacy-p2'])
    expect(payload.stats).toEqual([
      { name: '2pts', playerId: PLAYER_ID, timestamp: 1, type: 'success', value: 2 },
      { name: 'assist', playerId: null, timestamp: 2, type: 'secondary', value: 1 },
    ])
  })

  it('returns null (keep queued) while the team relation cannot resolve', () => {
    expect(toMatchPayload({ teamId: 'legacy-team' }, CLUB_ID, {}, {})).toBeNull()
  })

  it('keeps the payload when the teamId is already a PB id', () => {
    const payload = toMatchPayload({ teamId: TEAM_ID }, CLUB_ID, {}, {}) as Record<string, unknown>
    expect(payload.team).toBe(TEAM_ID)
  })
})

describe('toContactPayload', () => {
  it('maps the playerId into the player relation and keeps the text field', () => {
    const payload = toContactPayload(
      { firstName: 'Marie', playerId: 'legacy-player', relationship: 'mother' },
      CLUB_ID,
      { 'legacy-player': PLAYER_ID }
    ) as Record<string, unknown>
    expect(payload).toMatchObject({
      club: CLUB_ID,
      deletedAt: 0,
      firstName: 'Marie',
      player: PLAYER_ID,
      playerId: PLAYER_ID,
      relationship: 'mother',
    })
  })

  it('returns null (keep queued) while the player relation cannot resolve', () => {
    expect(toContactPayload({ playerId: 'legacy-player' }, CLUB_ID, {})).toBeNull()
  })
})

describe('fromPlayerRecord', () => {
  it('flattens server records into local raw data (0 deletedAt -> null live)', () => {
    const record: RemoteRecord = {
      birthDay: '1700000000000',
      deletedAt: 0,
      firstName: 'John',
      hasPhoto: true,
      id: PLAYER_ID,
      jerseyNumber: '00',
      lastName: 'Roe',
      updatedAt: 55,
    }
    const raw = fromPlayerRecord(record)
    expect(raw).toMatchObject({
      birthDay: 1_700_000_000_000,
      deletedAt: null,
      firstName: 'John',
      hasPhoto: true,
      id: PLAYER_ID,
      jerseyNumber: '00',
      lastName: 'Roe',
      updatedAt: 55,
    })
  })

  it('normalizes date-string birthdays to epoch milliseconds', () => {
    const raw = fromPlayerRecord({ birthDay: '2026-08-23', id: 'x' })
    expect(raw.birthDay).toBe(Date.parse('2026-08-23'))
  })

  it('converts tombstones and strips empty strings', () => {
    const raw = fromPlayerRecord({ deletedAt: 123, email: '', id: 'x', phone: '' })
    expect(raw.deletedAt).toBe(123)
    expect(raw.email).toBeUndefined()
    expect(raw.phone).toBeUndefined()
  })
})

describe('fromTeamRecord', () => {
  it('normalizes null playerIds and empty names', () => {
    const raw = fromTeamRecord({ deletedAt: 0, id: 'x', name: '', playerIds: null })
    expect(raw.playerIds).toEqual([])
    expect(raw.name).toBeNull()
    expect(raw.deletedAt).toBeNull()
  })
})

describe('fromMatchRecord', () => {
  it('maps the team relation back to teamId and sanitizes arrays and status', () => {
    const raw = fromMatchRecord({
      deletedAt: 7,
      id: 'm1',
      playersInTheFive: null,
      stats: { points: 21 },
      status: 'locked',
      team: TEAM_ID,
      type: 'other',
    })
    expect(raw.teamId).toBe(TEAM_ID)
    expect(raw.playersInTheFive).toEqual([])
    expect(raw.stats).toEqual([])
    expect(raw.status).toBe('locked')
    expect(raw.type).toBe('home')
    expect(raw.deletedAt).toBe(7)
  })
})

describe('fromContactRecord', () => {
  it('prefers the playerId text field and falls back to the player relation', () => {
    const raw = fromContactRecord({ id: 'c1', player: PLAYER_ID, playerId: PLAYER_ID })
    expect(raw.playerId).toBe(PLAYER_ID)
    const rawWithRelationOnly = fromContactRecord({ id: 'c2', player: PLAYER_ID })
    expect(rawWithRelationOnly.playerId).toBe(PLAYER_ID)
  })
})

describe('firstSyncDecision', () => {
  it('asks when both sides have data', () => {
    expect(firstSyncDecision(3, 2)).toBe('ask')
  })

  it('pushes local when the server is empty', () => {
    expect(firstSyncDecision(3, 0)).toBe('push-local')
  })

  it('pulls remote when local is empty', () => {
    expect(firstSyncDecision(0, 2)).toBe('pull-remote')
  })

  it('does nothing when both sides are empty', () => {
    expect(firstSyncDecision(0, 0)).toBe('idle')
  })
})

describe('computeWinners', () => {
  interface Item {
    id?: string
    updatedAt?: number
  }

  it('flags absent and strictly-newer remote records only', () => {
    const current: Item[] = [
      { id: 'a', updatedAt: 100 },
      { id: 'b', updatedAt: 100 },
    ]
    const remote: Item[] = [
      { id: 'a', updatedAt: 100 }, // tie -> local wins
      { id: 'b', updatedAt: 101 }, // newer -> remote wins
      { id: 'c', updatedAt: 50 }, // absent -> wins
      { id: 'd', updatedAt: 10 }, // omitted locally -> wins
    ]
    expect(computeWinners(current, remote)).toEqual([
      { id: 'b', updatedAt: 101 },
      { id: 'c', updatedAt: 50 },
      { id: 'd', updatedAt: 10 },
    ])
  })
})

describe('buildOutboxDiffs', () => {
  function diffs(collection: SyncCollection, current: unknown[], snapshot: Record<string, unknown>) {
    return buildOutboxDiffs(collection, current as never, snapshot as never, async () => false)
  }

  it('does not re-queue records that match the snapshot (no echo)', async () => {
    const player = { id: PLAYER_ID, updatedAt: 100 } as PlayerRawData
    const result = await diffs('players', [player], { [PLAYER_ID]: player })
    expect(result).toEqual([])
  })

  it('queues new records', async () => {
    const player = { firstName: 'New', id: PLAYER_ID, updatedAt: 50 } as PlayerRawData
    const [item] = await diffs('players', [player], {})
    expect(item).toMatchObject({ attempts: 0, collection: 'players', id: PLAYER_ID, updatedAt: 50 })
  })

  it('queues touched and tombstoned records', async () => {
    const baseline = { id: PLAYER_ID, updatedAt: 100 } as PlayerRawData
    const edited = { id: PLAYER_ID, updatedAt: 200 } as PlayerRawData
    expect(await diffs('players', [edited], { [PLAYER_ID]: baseline })).toHaveLength(1)

    const tombstoned = { deletedAt: 300, id: PLAYER_ID, updatedAt: 300 } as PlayerRawData
    expect(await diffs('players', [tombstoned], { [PLAYER_ID]: baseline })).toHaveLength(1)
  })

  it('re-queues records whose content changed without a timestamp bump (identity rewrite)', async () => {
    const baseline = { id: TEAM_ID, name: 'T', playerIds: ['1'], updatedAt: 100 } as TeamRawData
    const rewritten = { id: TEAM_ID, name: 'T', playerIds: [PLAYER_ID], updatedAt: 100 } as TeamRawData
    const [item] = await diffs('teams', [rewritten], { [TEAM_ID]: baseline })
    expect(item.id).toBe(TEAM_ID)
  })

  it('treats undefined valued keys as equal to missing keys', async () => {
    const baseline = { deletedAt: null, id: PLAYER_ID, updatedAt: 100 } as PlayerRawData
    const current = {
      deletedAt: null,
      email: undefined,
      firstName: undefined,
      id: PLAYER_ID,
      updatedAt: 100,
    } as PlayerRawData
    expect(await diffs('players', [current], { [PLAYER_ID]: baseline })).toEqual([])
  })

  it('skips records without ids', async () => {
    const result = await diffs('players', [{ updatedAt: 1 }], {})
    expect(result).toEqual([])
  })
})

describe('deepEqual', () => {
  it('compares nested JSON and ignores undefined-valued keys', () => {
    expect(deepEqual({ a: [1, 2, { b: 'x' }] }, { a: [1, 2, { b: 'x' }] })).toBe(true)
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(true)
    expect(deepEqual({ a: [1] }, { a: [1, 2] })).toBe(false)
    expect(deepEqual({ a: { c: 1 } }, { a: { c: 2 } })).toBe(false)
    expect(deepEqual(null, undefined)).toBe(false)
  })
})

describe('toPayload round-trip safety', () => {
  it('a pulled player pushed back produces a stable payload (club + ids intact)', () => {
    const record: RemoteRecord = {
      deletedAt: 0,
      firstName: 'John',
      hasPhoto: false,
      id: PLAYER_ID,
      jerseyNumber: '00',
      lastName: 'Roe',
      updatedAt: 25,
    }
    const raw: PlayerRawData = fromPlayerRecord(record)
    const payload = toPlayerPayload(raw, CLUB_ID) as Record<string, unknown>
    expect(payload.club).toBe(CLUB_ID)
    expect(payload.updatedAt).toBe(25)
    expect(payload.firstName).toBe('John')
  })
})
