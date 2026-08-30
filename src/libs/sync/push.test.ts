import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContactRawData } from '../contact/contact.d'
import type { MatchRawData } from '../match/match.d'
import type { PlayerRawData } from '../player/player.d'
import type { TeamRawData } from '../team/team.d'
import { isPbId } from './mapper'
import { clearOutbox, enqueueOutboxItem, getAllOutboxItems } from './outbox'
import { type DrainResult, drainOutbox, MAX_OUTBOX_ATTEMPTS, type PushContext } from './push'
import type { IdentityRewrites, IdMap, OutboxItem, SyncCollection } from './sync.d'

const P_ID = 'player000000001'
const T_ID = 'team00000000001'
const M_ID = 'match0000000001'
const C_ID = 'contact00000001'
const CLUB_ID = 'club00000000001'

type RawRecord = PlayerRawData | TeamRawData | MatchRawData | ContactRawData

let fakeIdCounter = 0
function nextFakeId(): string {
  fakeIdCounter += 1
  return String(fakeIdCounter).padStart(15, '0')
}

function fakeError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status })
}

class FakeService {
  created: Record<string, unknown>[] = []
  updated: { id: string; payload: Record<string, unknown> }[] = []
  deleted: string[] = []
  createImpl: ((payload: Record<string, unknown>) => unknown) | undefined
  updateImpl: ((id: string, payload: Record<string, unknown>) => unknown) | undefined
  readonly log: string[]
  readonly name: string

  constructor(name: string, log: string[]) {
    this.log = log
    this.name = name
  }

  getFullList = vi.fn(() => [])
  create = vi.fn((payload: Record<string, unknown>) => {
    this.log.push(`create:${this.name}`)
    if (this.createImpl) {
      return this.createImpl(payload)
    }
    const id = typeof payload.id === 'string' && isPbId(payload.id) ? payload.id : nextFakeId()
    const record = { ...payload, id }
    this.created.push(record)
    return record
  })
  update = vi.fn((id: string, payload: Record<string, unknown>) => {
    this.log.push(`update:${this.name}`)
    if (this.updateImpl) {
      return this.updateImpl(id, payload)
    }
    this.updated.push({ id, payload })
    return { id, ...payload }
  })
  delete = vi.fn((id: string) => {
    this.log.push(`delete:${this.name}`)
    this.deleted.push(id)
  })
  subscribe = vi.fn(() => () => undefined)
}

class FakePb {
  readonly log: string[] = []
  readonly services = new Map<string, FakeService>()

  constructor(collectionNames: string[]) {
    for (const name of collectionNames) {
      this.services.set(name, new FakeService(name, this.log))
    }
  }

  collection(name: string): FakeService {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`missing fake collection ${name}`)
    }
    return service
  }

  filter = (raw: string) => raw
}

let pb: FakePb
let raws: Record<SyncCollection, Record<string, RawRecord>>
let idMap: IdMap
let rewrites: IdentityRewrites[]
let pushed: Array<{ collection: SyncCollection; localId: string; pbId: string }>
let leaseConflicts: Array<{ collection: SyncCollection; localId: string; pbId: string }>
let warns: unknown[]
let dropped: Array<{ collection: SyncCollection; id: string }>

function blankIdMap(): IdMap {
  return { contacts: {}, matchs: {}, players: {}, teams: {} }
}

function makeContext(overrides: Partial<PushContext> = {}): PushContext {
  return {
    clubId: CLUB_ID,
    idMap,
    onDropped: (collection, id) => dropped.push({ collection, id }),
    onIdentityRewrites: (rewrite) => {
      rewrites.push(rewrite)
    },
    onItemPushed: ({ collection, localId, pbId }) => {
      pushed.push({ collection, localId, pbId })
    },
    onLeaseConflict: (conflict) => {
      leaseConflicts.push(conflict)
    },
    onWarn: (message) => warns.push(message),
    photoGetter: async () => undefined,
    resolvePlayerTeamPbIds: () => [],
    resolveRaw: (collection, id) => raws[collection][id] ?? null,
    role: 'owner',
    ...overrides,
  }
}

function queueItem(collection: SyncCollection, id: string, createdAt: number): OutboxItem {
  return { attempts: 0, collection, createdAt, id, updatedAt: createdAt }
}

beforeEach(async () => {
  fakeIdCounter = 0
  await clearOutbox()
  pb = new FakePb(['players', 'teams', 'matchs', 'contacts', 'team_players'])
  idMap = blankIdMap()
  rewrites = []
  pushed = []
  leaseConflicts = []
  warns = []
  dropped = []
  raws = { contacts: {}, matchs: {}, players: {}, teams: {} }
})

describe('drainOutbox', () => {
  it('pushes queued records in order: players -> teams (+junction) -> matchs -> contacts', async () => {
    const player = { firstName: 'John', id: P_ID, updatedAt: 1 } as PlayerRawData
    const team = { id: T_ID, name: 'Équipe', playerIds: [P_ID], updatedAt: 1 } as TeamRawData
    const match = { id: M_ID, opponent: 'Les Bleus', teamId: T_ID, updatedAt: 1 } as MatchRawData
    const contact = { id: C_ID, playerId: P_ID, updatedAt: 1 } as ContactRawData
    raws = {
      contacts: { [C_ID]: contact },
      matchs: { [M_ID]: match },
      players: { [P_ID]: player },
      teams: { [T_ID]: team },
    }
    await enqueueOutboxItem(queueItem('contacts', C_ID, 4))
    await enqueueOutboxItem(queueItem('matchs', M_ID, 3))
    await enqueueOutboxItem(queueItem('teams', T_ID, 2))
    await enqueueOutboxItem(queueItem('players', P_ID, 1))

    const result = await drainOutbox(pb as never, makeContext())

    expect(result).toEqual({ aborted: false, remaining: 0 })
    expect(pb.log).toEqual([
      'create:players',
      'create:teams',
      'create:team_players',
      'create:matchs',
      'create:contacts',
    ])
    expect(await getAllOutboxItems()).toEqual([])
  })

  it('pushes tombstones as updates (deletedAt) and never calls PB delete', async () => {
    const player = { deletedAt: 9, id: '42', updatedAt: 9 } as PlayerRawData
    raws.players['42'] = player
    idMap.players['42'] = P_ID
    await enqueueOutboxItem(queueItem('players', '42', 1))

    const result = await drainOutbox(pb as never, makeContext())

    expect(result.remaining).toBe(0)
    expect(pb.collection('players').updated).toHaveLength(1)
    expect(pb.collection('players').updated[0]?.id).toBe(P_ID)
    expect(pb.collection('players').updated[0]?.payload.deletedAt).toBe(9)
    expect(pb.collection('players').deleted).toEqual([])
  })

  it('rewrites legacy ids after a server create (id generated by PB)', async () => {
    raws.players['42'] = { firstName: 'Legacy', id: '42', updatedAt: 1 } as PlayerRawData
    await enqueueOutboxItem(queueItem('players', '42', 1))

    const result = await drainOutbox(pb as never, makeContext())

    expect(result).toEqual({ aborted: false, remaining: 0 })
    const [createdRecord] = pb.collection('players').created
    // No explicit id was sent for the legacy local id; the server generated one.
    expect(createdRecord?.id).toBe('000000000000001')
    expect(rewrites).toEqual([{ players: { '42': '000000000000001' } }])
    expect(idMap.players['42']).toBe('000000000000001')
    expect(pushed).toEqual([{ collection: 'players', localId: '42', pbId: '000000000000001' }])
  })

  it('uploads a pending photo blob after the record exists', async () => {
    raws.players[P_ID] = { hasPhoto: true, id: P_ID, updatedAt: 1 } as PlayerRawData
    await enqueueOutboxItem({ ...queueItem('players', P_ID, 1), photoPending: true })
    const blob = new Blob(['x'], { type: 'image/webp' })

    const result = await drainOutbox(pb as never, makeContext({ photoGetter: async () => blob }))

    expect(result.remaining).toBe(0)
    expect(pb.collection('players').updated).toHaveLength(1)
    expect(pb.collection('players').updated[0]).toMatchObject({ id: P_ID, payload: { photo: blob } })
  })

  it('looks up the photo blob at the post-rewrite key during a legacy create', async () => {
    raws.players['42'] = { hasPhoto: true, id: '42', updatedAt: 1 } as PlayerRawData
    await enqueueOutboxItem({ ...queueItem('players', '42', 1), photoPending: true })
    const photoGetter = vi.fn(async () => new Blob(['x'], { type: 'image/webp' }))

    const result = await drainOutbox(pb as never, makeContext({ photoGetter }))

    expect(result.remaining).toBe(0)
    // Post-rewrite key first, legacy key as the secondary candidate.
    expect(photoGetter).toHaveBeenCalledWith('000000000000001', '42')
  })

  it('classifies a match scoring-lease 403 as a conflict: item dropped, no attempts, notified once', async () => {
    const match = {
      id: M_ID,
      opponent: 'Les Bleus',
      stats: [{ name: '2pts', playerId: P_ID, timestamp: 1, type: 'success', value: 2 }],
      teamId: T_ID,
      updatedAt: 1,
    } as MatchRawData
    raws.matchs[M_ID] = match
    idMap.matchs[M_ID] = M_ID
    pb.collection('matchs').updateImpl = () => {
      throw fakeError(403, 'scoring is locked')
    }
    await enqueueOutboxItem(queueItem('matchs', M_ID, 1))

    const result = await drainOutbox(pb as never, makeContext())

    expect(result).toMatchObject({ aborted: false })
    expect(result.remaining).toBe(0)
    // The item is dropped instead of burning attempts or re-queued forever.
    expect(pb.collection('matchs').update).toHaveBeenCalledTimes(1)
    expect(await getAllOutboxItems()).toEqual([])
    expect(leaseConflicts).toEqual([{ collection: 'matchs', localId: M_ID, pbId: M_ID }])
  })

  it('keeps items queued on per-record validation errors and drops them after 5 attempts', async () => {
    raws.teams[T_ID] = { id: T_ID, name: 'X', updatedAt: 1 } as TeamRawData
    pb.collection('teams').createImpl = () => {
      throw fakeError(400, 'unmigratable legacy shape')
    }
    await enqueueOutboxItem(queueItem('teams', T_ID, 1))

    async function drainRepeatedly(roundsLeft: number): Promise<DrainResult> {
      const result = await drainOutbox(pb as never, makeContext())
      if (result.remaining === 0 || roundsLeft <= 1) {
        return result
      }
      return drainRepeatedly(roundsLeft - 1)
    }

    const final = await drainRepeatedly(MAX_OUTBOX_ATTEMPTS)
    expect(final).toEqual({ aborted: false, remaining: 0 })
    expect(dropped).toEqual([{ collection: 'teams', id: T_ID }])
    expect(warns.length).toBeGreaterThanOrEqual(MAX_OUTBOX_ATTEMPTS)
  })

  it('aborts the drain on network errors and keeps every item', async () => {
    raws.players[P_ID] = { id: P_ID, updatedAt: 1 } as PlayerRawData
    pb.collection('players').createImpl = () => {
      throw fakeError(0, 'network down')
    }
    await enqueueOutboxItem(queueItem('players', P_ID, 1))

    const result = await drainOutbox(pb as never, makeContext())

    expect(result).toMatchObject({ aborted: true })
    expect(result.remaining).toBe(1)
    const stored = await getAllOutboxItems()
    expect(stored[0]?.attempts).toBe(0)
  })

  it('keeps queued records whose relations cannot resolve yet (deferred)', async () => {
    raws.contacts[C_ID] = { id: C_ID, playerId: 'legacy-player', updatedAt: 1 } as ContactRawData
    await enqueueOutboxItem(queueItem('contacts', C_ID, 1))

    const result = await drainOutbox(pb as never, makeContext())

    expect(result).toEqual({ aborted: false, remaining: 1 })
    expect(pb.collection('contacts').created).toHaveLength(0)
    const stored = await getAllOutboxItems()
    expect(stored[0]?.attempts).toBe(1)
  })

  it('drops queue entries whose local record disappeared', async () => {
    await enqueueOutboxItem(queueItem('players', 'ghost', 1))

    const result = await drainOutbox(pb as never, makeContext())

    expect(result).toEqual({ aborted: false, remaining: 0 })
    expect(pb.collection('players').created).toHaveLength(0)
  })
})
