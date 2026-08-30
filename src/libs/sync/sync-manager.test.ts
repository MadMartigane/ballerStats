import { set } from 'idb-keyval'
import type PocketBase from 'pocketbase'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Match from '../match/match'
import { getPhoto, storePhoto } from '../photo-store/photo-store'
import { syncMetaStore } from './idb'
import type { RemoteRecord } from './sync.d'

const mock = vi.hoisted(() => ({
  isAuthEnabled: true,
  pb: {
    authStore: {
      clear: vi.fn(),
      isValid: true,
      model: { collectionName: 'users', id: 'u1' },
      onChange: vi.fn(() => () => undefined),
    },
    collection: vi.fn(),
    files: { getToken: vi.fn(async () => 'file-token'), getURL: () => '' },
    filter: (raw: string) => raw,
  },
}))

vi.mock('../pocketbase/client', () => ({ isAuthEnabled: mock.isAuthEnabled, pb: mock.pb }))
vi.mock('../utils/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/utils')>()
  // The toast template store does not exist under jsdom; keep the rest real.
  return { ...actual, toast: vi.fn() }
})

import { currentClub, currentRole, currentUser } from '../auth/auth'
import orchestrator from '../orchestrator/orchestrator'
import Player from '../player/player'
import { clearOutbox, getAllOutboxItems } from './outbox'
import { SyncManager } from './sync-manager'

const CLUB_ID = 'club00000000001'

function makeCollection(initial: RemoteRecord[] = []) {
  const records = new Map(initial.map((record) => [record.id, record]))
  return {
    create: vi.fn((payload: Record<string, unknown>) => {
      const id = typeof payload.id === 'string' ? payload.id : 'created0000000001'
      const record = { ...payload, id }
      records.set(id, record)
      return record
    }),
    delete: vi.fn(() => undefined),
    getFullList: vi.fn(() => [...records.values()]),
    getOne: vi.fn((id: string) => records.get(id)),
    subscribe: vi.fn(() => () => undefined),
    update: vi.fn((id: string, payload: Record<string, unknown>) => {
      const record = { ...records.get(id), ...payload, id }
      records.set(id, record)
      return record
    }),
  }
}

function installFakePb(collections: Record<string, ReturnType<typeof makeCollection>>) {
  mock.pb.collection.mockImplementation((name: string) => collections[name])
}

function emptyCollections() {
  return {
    contacts: makeCollection(),
    matchs: makeCollection(),
    players: makeCollection(),
    team_players: makeCollection(),
    teams: makeCollection(),
  }
}

async function presetResolvedSync() {
  await set(
    'syncMeta',
    {
      firstSyncResolved: true,
      idMap: { contacts: {}, matchs: {}, players: {}, teams: {} },
      lastPullAt: {},
      snapshot: { contacts: {}, matchs: {}, players: {}, teams: {} },
    },
    syncMetaStore
  )
}

function logIn() {
  currentUser.set({ email: 'owner@baller.local', id: 'u1', name: 'Dev Owner' })
  currentClub.set({ id: CLUB_ID, name: 'Dev Club' })
  currentRole.set('owner')
}

beforeEach(async () => {
  vi.clearAllMocks()
  await clearOutbox()
  orchestrator.replaceDataset({ contacts: [], matchs: [], players: [], teams: [] })
  logIn()
})

describe('SyncManager local-first sync', () => {
  it('adopts remote data on an empty local store and queues nothing (no echo)', async () => {
    const collections = emptyCollections()
    collections.players = makeCollection([
      { club: CLUB_ID, deletedAt: 0, firstName: 'Remote', hasPhoto: false, id: 'aaaa11111111111', updatedAt: 200 },
    ])
    installFakePb(collections)

    const manager = new SyncManager(mock.pb as unknown as PocketBase)
    await manager.start()
    await manager.stop()

    // First-sync (local empty, remote non-empty) resolved by pulling; nothing
    // from the pull was re-enqueued.
    expect(await getAllOutboxItems()).toEqual([])
    expect(orchestrator.Players.getRawData().map((player) => player.id)).toEqual(['aaaa11111111111'])
    expect(orchestrator.Players.getRawData()[0]?.firstName).toBe('Remote')
  })

  it('different data on both sides requires an explicit resolution', async () => {
    const collections = emptyCollections()
    collections.players = makeCollection([
      { club: CLUB_ID, deletedAt: 0, firstName: 'Remote', hasPhoto: false, id: 'aaaa11111111111', updatedAt: 200 },
    ])
    installFakePb(collections)
    orchestrator.replaceDataset({
      contacts: [],
      matchs: [],
      players: [new Player({ firstName: 'Local', id: 'bbbb11111111112', updatedAt: 100 })],
      teams: [],
    })

    const manager = new SyncManager(mock.pb as unknown as PocketBase)
    await manager.start()
    await manager.stop()

    // 'ask' — no silent merge, the conflict state + modal take over.
    expect(await getAllOutboxItems()).toEqual([])
    expect(orchestrator.Players.getRawData().map((player) => player.firstName)).toContain('Local')
  })

  it('applies remote LWW winners without echo and pushes newer local changes', async () => {
    await presetResolvedSync()
    const localId = 'cccc11111111113'
    orchestrator.replaceDataset({
      contacts: [],
      matchs: [],
      players: [new Player({ firstName: 'Local', id: localId, updatedAt: 100 })],
      teams: [],
    })
    const collections = emptyCollections()
    collections.players = makeCollection([
      { club: CLUB_ID, deletedAt: 0, firstName: 'Remote', hasPhoto: false, id: localId, updatedAt: 200 },
    ])
    installFakePb(collections)

    const manager = new SyncManager(mock.pb as unknown as PocketBase)
    await manager.start()

    // The remote copy (newer) won the merge and no echo was queued.
    expect(orchestrator.Players.getRawData()[0]).toMatchObject({ firstName: 'Remote', updatedAt: 200 })
    expect(await getAllOutboxItems()).toEqual([])

    // A newer local edit is pushed to the server afterwards.
    const localPlayer = orchestrator.getPlayer(localId)
    expect(localPlayer).not.toBeNull()
    if (localPlayer) {
      localPlayer.update({ lastName: 'Edited' })
      orchestrator.Players.updatePlayer(localPlayer)
    }
    await manager.syncNow()
    await manager.stop()

    expect(collections.players.update).toHaveBeenCalledTimes(1)
    expect(collections.players.update.mock.calls[0]?.[0]).toBe(localId)
    const payload = collections.players.update.mock.calls[0]?.[1] as Record<string, unknown>
    expect(payload).toMatchObject({ club: CLUB_ID, lastName: 'Edited' })
    expect(await getAllOutboxItems()).toEqual([])
  })

  it('pushed records are not re-queued by their own change events', async () => {
    await presetResolvedSync()
    const localId = 'ddd111111111114'
    orchestrator.replaceDataset({
      contacts: [],
      matchs: [],
      players: [new Player({ firstName: 'First', id: localId, updatedAt: 100 })],
      teams: [],
    })
    const collections = emptyCollections()
    installFakePb(collections)

    const manager = new SyncManager(mock.pb as unknown as PocketBase)
    await manager.start()
    await manager.stop()

    // Start pushed the local player exactly once; the rewrite/snapshot events
    // from that push must not have re-queued it.
    expect(collections.players.create).toHaveBeenCalledTimes(1)
    expect(await getAllOutboxItems()).toEqual([])
    expect(orchestrator.Players.getRawData()[0]).toMatchObject({ firstName: 'First', id: localId })
  })

  it('moves the photo blob when a legacy player id is rewritten on push', async () => {
    await presetResolvedSync()
    const legacyId = '42'
    await storePhoto(legacyId, new Blob(['photo'], { type: 'image/webp' }))
    orchestrator.replaceDataset({
      contacts: [],
      matchs: [],
      players: [new Player({ firstName: 'Legacy', hasPhoto: true, id: legacyId, updatedAt: 100 })],
      teams: [],
    })
    const collections = emptyCollections()
    installFakePb(collections)

    const manager = new SyncManager(mock.pb as unknown as PocketBase)
    await manager.start()
    await manager.stop()

    const newId = 'created0000000001'
    // The blob was moved to the server-generated id and uploaded.
    expect(await getPhoto(newId)).toBeDefined()
    expect(await getPhoto(legacyId)).toBeUndefined()
    expect(collections.players.update).toHaveBeenCalledTimes(1)
    const [uploadId, uploadPayload] = collections.players.update.mock.calls[0] as [string, Record<string, unknown>]
    expect(uploadId).toBe(newId)
    expect(uploadPayload.photo).toBeDefined()
    expect(orchestrator.Players.getRawData()[0]?.id).toBe(newId)
  })

  it('re-queues the local copy when the server drifted underneath it (issue: drift re-enqueue)', async () => {
    await presetResolvedSync()
    const localId = 'eee111111111115'
    orchestrator.replaceDataset({
      contacts: [],
      matchs: [],
      players: [new Player({ firstName: 'Local', id: localId, updatedAt: 100 })],
      teams: [],
    })
    // The snapshot says the local copy was already synced before.
    await set(
      'syncMeta',
      {
        firstSyncResolved: true,
        idMap: { contacts: {}, matchs: {}, players: { [localId]: localId }, teams: {} },
        lastPullAt: {},
        snapshot: {
          contacts: {},
          matchs: {},
          players: { [localId]: { firstName: 'Local', id: localId, updatedAt: 100 } },
          teams: {},
        },
      },
      syncMetaStore
    )
    // The server changed the same record with an OLDER timestamp (clock skew).
    const collections = emptyCollections()
    collections.players = makeCollection([
      { club: CLUB_ID, deletedAt: 0, firstName: 'Drifted', hasPhoto: false, id: localId, updatedAt: 100 },
    ])
    installFakePb(collections)

    const manager = new SyncManager(mock.pb as unknown as PocketBase)
    await manager.start()
    await manager.stop()

    // The local copy was re-queued and pushed back over the drift.
    expect(collections.players.update).toHaveBeenCalledTimes(1)
    const payload = collections.players.update.mock.calls[0]?.[1] as Record<string, unknown>
    expect(payload).toMatchObject({ firstName: 'Local', updatedAt: 100 })
    expect(await getAllOutboxItems()).toEqual([])
  })

  it('adopts the server copy when a match push is rejected by the scoring lease', async () => {
    await presetResolvedSync()
    const matchId = 'ffff11111111111'
    const teamId = 'team00000000001'
    const playerId = 'player000000001'
    orchestrator.replaceDataset({
      contacts: [],
      matchs: [
        new Match({
          id: matchId,
          opponent: 'Les Bleus',
          stats: [{ name: '2pts', playerId, timestamp: 1, type: 'success', value: 2 }],
          status: 'locked',
          teamId,
          updatedAt: 100,
        }),
      ],
      players: [new Player({ firstName: 'A', id: playerId })],
      teams: [],
    })
    const collections = emptyCollections()
    installFakePb(collections)
    // The scorer holds the lease on the server.
    collections.matchs.update.mockImplementation(() => {
      throw Object.assign(new Error('scoring is locked'), { status: 403 })
    })
    collections.matchs.getOne.mockImplementation(() => ({
      club: CLUB_ID,
      deletedAt: 0,
      id: matchId,
      opponent: 'Les Bleus',
      stats: [{ name: '3pts', playerId, timestamp: 5, type: 'success', value: 3 }],
      status: 'locked',
      team: teamId,
      updatedAt: 500,
    }))
    // idMap says the match was already created server-side.
    await set(
      'syncMeta',
      {
        firstSyncResolved: true,
        idMap: { contacts: {}, matchs: { [matchId]: matchId }, players: {}, teams: {} },
        lastPullAt: {},
        snapshot: { contacts: {}, matchs: {}, players: {}, teams: {} },
      },
      syncMetaStore
    )

    const manager = new SyncManager(mock.pb as unknown as PocketBase)
    await manager.start()
    await manager.stop()

    // The local diff was dropped and the server (lease holder) copy adopted.
    expect(await getAllOutboxItems()).toEqual([])
    expect(orchestrator.Matchs.getRawData()[0]).toMatchObject({
      id: matchId,
      stats: [{ name: '3pts', playerId, timestamp: 5, type: 'success', value: 3 }],
      updatedAt: 500,
    })
  })
})
