import type PocketBase from 'pocketbase'
import type { ClientResponseError } from 'pocketbase'
import type { MembershipRole } from '../auth/auth.d'
import type { ContactRawData } from '../contact/contact.d'
import type { MatchRawData } from '../match/match.d'
import type { PlayerRawData } from '../player/player.d'
import type { TeamRawData } from '../team/team.d'
import { SYNC_COLLECTIONS } from './constants'
import { isPbId, toPayload, toPlayerPayload } from './mapper'
import { getAllOutboxItems, removeOutboxItem, setOutboxAttempts } from './outbox'
import { uploadPlayerPhoto } from './photos'
import type { IdentityRewrites, IdMap, OutboxItem, SyncCollection } from './sync.d'
import { syncTeamPlayers } from './team-players'

export const MAX_OUTBOX_ATTEMPTS = 5

type RawRecord = PlayerRawData | TeamRawData | MatchRawData | ContactRawData

type RecordService = { create: (payload: Record<string, unknown>) => Promise<{ id: string }> } & {
  update: (id: string, payload: Record<string, unknown>) => Promise<{ id: string }>
}

export interface LeaseConflict {
  collection: SyncCollection
  localId: string
  pbId: string
}

export interface PushContext {
  clubId: string
  /** localId -> pbId map, mutated in place as records are created. */
  idMap: IdMap
  onDropped: (collection: SyncCollection, id: string) => void
  onIdentityRewrites: (rewrites: IdentityRewrites, photoMoves: [string, string][]) => Promise<void> | void
  onItemPushed: (pushed: {
    collection: SyncCollection
    localId: string
    pbId: string
    raw: RawRecord
  }) => Promise<void> | void
  /** Server rejected the write (scoring lease) — the item is dropped, the manager reconciles. */
  onLeaseConflict: (conflict: LeaseConflict) => Promise<void> | void
  onWarn: (message: string) => void
  /** Local blob lookup: primary id (post-rewrite) first, then the legacy id. */
  photoGetter: (primaryId: string, secondaryId?: string) => Promise<Blob | undefined>
  /** Teams (PB ids) containing a player, used for staff player creates (players_attach hook). */
  resolvePlayerTeamPbIds: (playerId: string) => string[]
  /** Live local raw record for a queued item (rebuilt payloads use fresh id mappings). */
  resolveRaw: (collection: SyncCollection, id: string) => RawRecord | null
  role: MembershipRole | null
}

export interface DrainResult {
  aborted: boolean
  remaining: number
}

function getErrorStatus(err: unknown): number {
  return err instanceof Error ? ((err as ClientResponseError).status ?? 0) : 0
}

function isSoftFailure(status: number): boolean {
  // Keep the item queued and retry on validation/rule/per-item errors; abort the
  // whole drain on network (0), session (401) or server-side (>=500) errors.
  return status !== 0 && status !== 401 && status < 500
}

type PushOutcome = 'pushed' | 'deferred' | 'abort' | 'conflict'

/** Pushes a single queued item. Soft failures stay queued (drop after 5 attempts). */
async function pushOne(
  pb: PocketBase,
  collection: SyncCollection,
  item: OutboxItem,
  raw: RawRecord,
  ctx: PushContext
): Promise<PushOutcome> {
  const service = pb.collection(collection)
  const idMap = ctx.idMap[collection]
  const localId = item.id
  const existingPbId = idMap[localId]
  const payload = buildPayload(collection, raw, existingPbId, ctx)
  if (payload === null) {
    return failItem(ctx, item, 'relation not resolvable yet')
  }

  const upsert = await upsertRecord(service, localId, existingPbId, payload, idMap)
  if (upsert.kind === 'soft-failure') {
    return handleSoftFailure(collection, existingPbId, upsert, payload, item, ctx)
  }
  if (upsert.kind === 'abort') {
    ctx.onWarn(`Sync interrompu sur ${collection}/${localId}: ${upsert.message}`)
    return 'abort'
  }
  const { createdWithLegacyId } = upsert
  if (createdWithLegacyId) {
    // Legacy numeric id -> keep the server-generated id locally: the manager
    // re-keys the record and every foreign key referencing it, and moves the
    // photo blob to the new key.
    const rewrites: IdentityRewrites = { [collection]: { [localId]: createdWithLegacyId } }
    const photoMoves: [string, string][] = collection === 'players' ? [[localId, createdWithLegacyId]] : []
    await ctx.onIdentityRewrites(rewrites, photoMoves)
  }

  if (item.photoPending && collection === 'players') {
    const blob = await ctx.photoGetter(upsert.pbId, localId)
    if (blob) {
      try {
        await uploadPlayerPhoto(pb, upsert.pbId, blob)
      } catch (err) {
        // Keep the item queued so the blob upload retries next cycle.
        return failItem(ctx, item, `photo upload failed for ${localId}: ${String(err)}`)
      }
    }
  }

  await removeOutboxItem(collection, localId)
  await ctx.onItemPushed({ collection, localId, pbId: upsert.pbId, raw })

  if (collection === 'teams') {
    const playerIds = (raw as TeamRawData).playerIds ?? []
    const mappedPlayerIds = playerIds.map((playerId) => ctx.idMap.players[playerId] ?? playerId)
    await syncTeamPlayers(pb, ctx.clubId, upsert.pbId, mappedPlayerIds, ctx.onWarn)
  }

  return 'pushed'
}

function isLeaseConflict(
  collection: SyncCollection,
  existingPbId: string | undefined,
  status: number,
  payload: Record<string, unknown>
): boolean {
  if (collection !== 'matchs' || !existingPbId || status !== 403) {
    return false
  }
  // The scoring-least hook rejects updates touching the scoring fields.
  return 'stats' in payload || 'playersInTheFive' in payload
}

function buildPayload(
  collection: SyncCollection,
  raw: RawRecord,
  existingPbId: string | undefined,
  ctx: PushContext
): Record<string, unknown> | null {
  const willCreate = !existingPbId || !isPbId(existingPbId)
  if (collection === 'players') {
    const teamIdsForCreate =
      willCreate && ctx.role === 'staff' ? ctx.resolvePlayerTeamPbIds(raw.id as string) : undefined
    return toPlayerPayload(raw as PlayerRawData, ctx.clubId, teamIdsForCreate)
  }
  return toPayload(collection, raw, ctx.clubId, ctx.idMap)
}

async function handleSoftFailure(
  collection: SyncCollection,
  existingPbId: string | undefined,
  upsert: Extract<UpsertOutcome, { kind: 'soft-failure' }>,
  payload: Record<string, unknown>,
  item: OutboxItem,
  ctx: PushContext
): Promise<PushOutcome> {
  if (isLeaseConflict(collection, existingPbId, upsert.status, payload)) {
    // Scoring lease held elsewhere: the server keeps its copy. Drop the local
    // diff without burning attempts; the manager adopts the server version.
    await removeOutboxItem(collection, item.id)
    await ctx.onLeaseConflict({ collection, localId: item.id, pbId: existingPbId as string })
    return 'conflict'
  }
  return failItem(ctx, item, `push ${collection}/${item.id} failed: ${upsert.message}`)
}

type UpsertOutcome =
  | { createdWithLegacyId?: string; kind: 'pushed'; pbId: string }
  | { kind: 'abort'; message: string; status: number }
  | { kind: 'soft-failure'; message: string; status: number }

function upsertNetworkFailure(status: number): 'abort' | 'soft-failure' {
  return isSoftFailure(status) ? 'soft-failure' : 'abort'
}

async function upsertRecord(
  service: RecordService,
  localId: string,
  existingPbId: string | undefined,
  payload: Record<string, unknown>,
  idMap: Record<string, string>
): Promise<UpsertOutcome> {
  if (existingPbId && isPbId(existingPbId)) {
    try {
      await service.update(existingPbId, payload)
      return { kind: 'pushed', pbId: existingPbId }
    } catch (err) {
      if (getErrorStatus(err) !== 404) {
        const status = getErrorStatus(err)
        return { kind: upsertNetworkFailure(status), message: `HTTP ${status}: ${String(err)}`, status }
      }
      // Record vanished server-side — fall through and recreate it.
    }
  }
  try {
    const isExplicitId = isPbId(localId)
    const created = isExplicitId ? await service.create({ ...payload, id: localId }) : await service.create(payload)
    if (created.id !== localId) {
      idMap[localId] = created.id
      return { createdWithLegacyId: created.id, kind: 'pushed', pbId: created.id }
    }
    idMap[created.id] = created.id
    return { kind: 'pushed', pbId: created.id }
  } catch (err) {
    const status = getErrorStatus(err)
    return { kind: upsertNetworkFailure(status), message: `HTTP ${status}: ${String(err)}`, status }
  }
}

async function failItem(ctx: PushContext, item: OutboxItem, message: string): Promise<'deferred'> {
  const attempts = item.attempts + 1
  if (attempts >= MAX_OUTBOX_ATTEMPTS) {
    await removeOutboxItem(item.collection, item.id)
    ctx.onDropped(item.collection, item.id)
    ctx.onWarn(`Outbox item abandonné (${attempts} tentatives) ${item.collection}/${item.id}: ${message}`)
    return 'deferred'
  }
  await setOutboxAttempts(item.collection, item.id, attempts)
  ctx.onWarn(`${message} (tentative ${attempts}/${MAX_OUTBOX_ATTEMPTS})`)
  return 'deferred'
}

/**
 * Drains the outbox in push order: players -> teams (+team_players) -> matchs
 * -> contacts. Soft failures keep items queued (dropped after 5 attempts or
 * on lease conflicts); network/session/server errors abort the drain so nothing
 * is lost.
 */
export async function drainOutbox(pb: PocketBase, ctx: PushContext): Promise<DrainResult> {
  const items = await getAllOutboxItems()
  const ordered = [...items].sort(
    (a, b) =>
      SYNC_COLLECTIONS.indexOf(a.collection) - SYNC_COLLECTIONS.indexOf(b.collection) || a.createdAt - b.createdAt
  )
  const ghostItems: { collection: SyncCollection; id: string }[] = []
  let aborted = false

  await ordered.reduce<Promise<void>>(async (pending, item) => {
    await pending
    if (aborted) {
      return
    }
    const raw = ctx.resolveRaw(item.collection, item.id)
    if (!raw) {
      // The record no longer exists locally — nothing to push.
      ghostItems.push({ collection: item.collection, id: item.id })
      return
    }
    const outcome = await pushOne(pb, item.collection, item, raw, ctx)
    if (outcome === 'abort') {
      aborted = true
    }
  }, Promise.resolve())

  await Promise.all(ghostItems.map((ghost) => removeOutboxItem(ghost.collection, ghost.id)))

  const remaining = (await getAllOutboxItems()).length
  return { aborted, remaining }
}
