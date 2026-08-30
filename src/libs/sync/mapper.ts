import type { ContactRawData } from '../contact/contact.d'
import type { MatchRawData } from '../match/match.d'
import type { PlayerRawData } from '../player/player.d'
import type { TeamRawData } from '../team/team.d'
import type { FirstSyncDecision, IdMap, OutboxItem, RemoteRecord, SyncCollection } from './sync.d'

/** PocketBase record ids are exactly 15 chars from [a-z0-9]; legacy imports use numeric-string ids. */
export const PB_ID_REGEX = /^[a-z0-9]{15}$/

export function isPbId(id: string | undefined): boolean {
  return id !== undefined && PB_ID_REGEX.test(id)
}

type RawRecord = PlayerRawData | TeamRawData | MatchRawData | ContactRawData

function deletedAtForPayload(deletedAt: number | null | undefined): number {
  // Server number field defaults to 0; null would force an explicit null in the
  // record, so live records are sent as 0 (converted back to null on pull).
  return deletedAt && deletedAt > 0 ? deletedAt : 0
}

/**
 * Local player -> PB `players` payload. `teamIdsForCreate` is only set for
 * staff-created records (the players_attach hook requires it for staff).
 */
export function toPlayerPayload(
  raw: PlayerRawData,
  clubId: string,
  teamIdsForCreate?: string[]
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    birthDay: raw.birthDay !== undefined && raw.birthDay !== null ? String(raw.birthDay) : '',
    club: clubId,
    deletedAt: deletedAtForPayload(raw.deletedAt),
    hasPhoto: Boolean(raw.hasPhoto),
    updatedAt: raw.updatedAt ?? 0,
  }

  if (raw.firstName) {
    payload.firstName = raw.firstName
  }
  if (raw.lastName) {
    payload.lastName = raw.lastName
  }
  if (raw.nicName) {
    payload.nicName = raw.nicName
  }
  if (raw.jerseyNumber) {
    payload.jerseyNumber = raw.jerseyNumber
  }
  if (raw.licenseNumber) {
    payload.licenseNumber = raw.licenseNumber
  }
  if (raw.email) {
    payload.email = raw.email
  }
  if (raw.phone) {
    payload.phone = raw.phone
  }
  if (teamIdsForCreate && teamIdsForCreate.length > 0) {
    payload.teamIds = teamIdsForCreate
  }

  return payload
}

/** Local team -> PB `teams` payload. playerIds are mapped through the player id map. */
export function toTeamPayload(
  raw: TeamRawData,
  clubId: string,
  playerIdMap: Record<string, string>
): Record<string, unknown> {
  const playerIds = (raw.playerIds ?? []).map((playerId) => playerIdMap[playerId] ?? playerId)
  return {
    club: clubId,
    deletedAt: deletedAtForPayload(raw.deletedAt),
    name: raw.name ?? '',
    playerIds,
    updatedAt: raw.updatedAt ?? 0,
  }
}

/**
 * Local match -> PB `matchs` payload. The client `teamId` becomes the server
 * `team` relation and embedded player ids (playersInTheFive, stats[].playerId)
 * are mapped through the player id map; returns null until the team has a
 * resolvable PB id (keep the item queued, teams are pushed before matchs).
 */
export function toMatchPayload(
  raw: MatchRawData,
  clubId: string,
  teamIdMap: Record<string, string>,
  playerIdMap: Record<string, string>
): Record<string, unknown> | null {
  const rawTeamId = raw.teamId ? (teamIdMap[raw.teamId] ?? raw.teamId) : ''
  if (!isPbId(rawTeamId)) {
    return null
  }
  const mapPlayerId = (playerId: string) => playerIdMap[playerId] ?? playerId
  const stats = (raw.stats ?? []).map((entry) =>
    entry.playerId ? { ...entry, playerId: mapPlayerId(entry.playerId) } : entry
  )
  return {
    championship: raw.championship ?? '',
    club: clubId,
    date: raw.date ?? '',
    deletedAt: deletedAtForPayload(raw.deletedAt),
    opponent: raw.opponent ?? '',
    playersInTheFive: (raw.playersInTheFive ?? []).map(mapPlayerId),
    stats,
    status: raw.status ?? 'unlocked',
    team: rawTeamId,
    type: raw.type ?? 'home',
    updatedAt: raw.updatedAt ?? 0,
  }
}

/**
 * Local contact -> PB `contacts` payload. The client `playerId` becomes the
 * required `player` relation (kept as text too for legacy queries); returns
 * null until the player has a resolvable PB id.
 */
export function toContactPayload(
  raw: ContactRawData,
  clubId: string,
  playerIdMap: Record<string, string>
): Record<string, unknown> | null {
  const rawPlayerId = raw.playerId ? (playerIdMap[raw.playerId] ?? raw.playerId) : ''
  if (!isPbId(rawPlayerId)) {
    return null
  }
  return {
    address: raw.address ?? '',
    club: clubId,
    deletedAt: deletedAtForPayload(raw.deletedAt),
    email: raw.email ?? '',
    firstName: raw.firstName ?? '',
    lastName: raw.lastName ?? '',
    phone: raw.phone ?? '',
    player: rawPlayerId,
    playerId: rawPlayerId,
    relationship: raw.relationship ?? 'other',
    updatedAt: raw.updatedAt ?? 0,
  }
}

/** Dispatches a local raw record to its PB payload for the given collection. */
export function toPayload(
  collection: SyncCollection,
  raw: RawRecord,
  clubId: string,
  idMap: IdMap
): Record<string, unknown> | null {
  switch (collection) {
    case 'players':
      return toPlayerPayload(raw as PlayerRawData, clubId)
    case 'teams':
      return toTeamPayload(raw as TeamRawData, clubId, idMap.players)
    case 'matchs':
      return toMatchPayload(raw as MatchRawData, clubId, idMap.teams, idMap.players)
    case 'contacts':
      return toContactPayload(raw as ContactRawData, clubId, idMap.players)
    default:
      // Exhaustive over the closed SyncCollection union.
      return null
  }
}

function fromBaseRecord(record: RemoteRecord): { deletedAt: number | null; id: string; updatedAt: number } {
  const deletedAt = typeof record.deletedAt === 'number' && record.deletedAt > 0 ? record.deletedAt : null
  return { deletedAt, id: record.id, updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0 }
}

/** Server text birthDay -> epoch ms (numeric strings) or a Date-parsable value. */
function parseBirthDay(value: unknown): number | undefined {
  if (typeof value !== 'string' || value === '') {
    return undefined
  }
  const numeric = Number(value)
  if (!Number.isNaN(numeric)) {
    return numeric
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

/** PB `players` record -> local raw data ('' -> undefined, 0 deletedAt -> null). */
export function fromPlayerRecord(record: RemoteRecord): PlayerRawData {
  const base = fromBaseRecord(record)
  return {
    ...base,
    birthDay: parseBirthDay(record.birthDay),
    email: typeof record.email === 'string' && record.email !== '' ? record.email : undefined,
    firstName: typeof record.firstName === 'string' && record.firstName !== '' ? record.firstName : undefined,
    hasPhoto: Boolean(record.hasPhoto),
    jerseyNumber:
      typeof record.jerseyNumber === 'string' && record.jerseyNumber !== '' ? record.jerseyNumber : undefined,
    lastName: typeof record.lastName === 'string' && record.lastName !== '' ? record.lastName : undefined,
    licenseNumber:
      typeof record.licenseNumber === 'string' && record.licenseNumber !== '' ? record.licenseNumber : undefined,
    nicName: typeof record.nicName === 'string' && record.nicName !== '' ? record.nicName : undefined,
    phone: typeof record.phone === 'string' && record.phone !== '' ? record.phone : undefined,
  }
}

/** PB `teams` record -> local raw data. */
export function fromTeamRecord(record: RemoteRecord): TeamRawData {
  const base = fromBaseRecord(record)
  return {
    ...base,
    name: typeof record.name === 'string' && record.name !== '' ? record.name : null,
    playerIds: Array.isArray(record.playerIds) ? record.playerIds.map(String) : [],
  }
}

/** PB `matchs` record -> local raw data (`team` relation -> `teamId`). */
export function fromMatchRecord(record: RemoteRecord): MatchRawData {
  const base = fromBaseRecord(record)
  const type = record.type === 'home' || record.type === 'outside' ? record.type : 'home'
  const status = record.status === 'locked' ? 'locked' : 'unlocked'
  return {
    ...base,
    championship: typeof record.championship === 'string' && record.championship !== '' ? record.championship : null,
    date: typeof record.date === 'string' && record.date !== '' ? record.date : null,
    opponent: typeof record.opponent === 'string' && record.opponent !== '' ? record.opponent : null,
    playersInTheFive: Array.isArray(record.playersInTheFive) ? record.playersInTheFive.map(String) : [],
    stats: Array.isArray(record.stats) ? record.stats : [],
    status,
    teamId: typeof record.team === 'string' && record.team !== '' ? record.team : null,
    type,
  }
}

/** PB `contacts` record -> local raw data (`player` relation kept as `playerId`). */
export function fromContactRecord(record: RemoteRecord): ContactRawData {
  const base = fromBaseRecord(record)
  const playerId = typeof record.playerId === 'string' && record.playerId !== '' ? record.playerId : undefined
  const relationPlayerId = typeof record.player === 'string' && record.player !== '' ? record.player : undefined
  return {
    ...base,
    address: typeof record.address === 'string' && record.address !== '' ? record.address : undefined,
    email: typeof record.email === 'string' && record.email !== '' ? record.email : undefined,
    firstName: typeof record.firstName === 'string' && record.firstName !== '' ? record.firstName : undefined,
    lastName: typeof record.lastName === 'string' && record.lastName !== '' ? record.lastName : undefined,
    phone: typeof record.phone === 'string' && record.phone !== '' ? record.phone : undefined,
    playerId: playerId ?? relationPlayerId,
    relationship:
      record.relationship === 'mother' || record.relationship === 'father' || record.relationship === 'other'
        ? record.relationship
        : 'other',
  }
}

/**
 * v1 first-sync guard: both sides non-empty requires an explicit user choice;
 * otherwise the smaller side is adopted automatically.
 */
export function firstSyncDecision(localTotal: number, remoteTotal: number): FirstSyncDecision {
  if (localTotal > 0 && remoteTotal > 0) {
    return 'ask'
  }
  if (localTotal > 0) {
    return 'push-local'
  }
  if (remoteTotal > 0) {
    return 'pull-remote'
  }
  return 'idle'
}

/** Remote records that win the per-record LWW merge (strictly newer updatedAt,
 * or absent locally) — those must be snapshotted as synced to avoid echo.
 */
export function computeWinners<T extends { id?: string; updatedAt?: number }>(current: T[], remote: T[]): T[] {
  return remote.filter((item) => {
    if (!item.id) {
      return false
    }
    const local = current.find((candidate) => candidate.id === item.id)
    return !local || (item.updatedAt ?? 0) > (local.updatedAt ?? 0)
  })
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Deep equality for plain JSON raw records. Keys whose value is `undefined` are
 * treated as absent, so mapper outputs (which may carry `undefined` fields) and
 * `getRawData()` outputs (which omit them) compare equal.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aEntries = Object.entries(a).filter(([, value]) => value !== undefined)
    const bEntries = Object.entries(b).filter(([, value]) => value !== undefined)
    if (aEntries.length !== bEntries.length) {
      return false
    }
    const bMap = new Map(bEntries)
    return aEntries.every(([key, value]) => bMap.has(key) && deepEqual(value, bMap.get(key)))
  }
  return false
}

/**
 * Pure diff between the live records and the last-synced snapshot: new or
 * content-changed records (local edits, identity rewrites, server drift) are
 * queued. `isPhotoPending` lets the caller decide whether the local photo blob
 * needs an upload.
 */
export async function buildOutboxDiffs(
  collection: SyncCollection,
  current: RawRecord[],
  snapshot: Record<string, RawRecord>,
  isPhotoPending: (recordId: string, record: RawRecord) => boolean | Promise<boolean>
): Promise<OutboxItem[]> {
  const diffs: OutboxItem[] = []
  const candidates: Array<{ diff: OutboxItem; record: RawRecord }> = []
  for (const record of current) {
    if (!record.id) {
      continue
    }
    const baseline = snapshot[record.id]
    const mutated = !baseline || !deepEqual(baseline, record)
    if (!mutated) {
      continue
    }
    const diff: OutboxItem = {
      attempts: 0,
      collection,
      createdAt: Date.now(),
      id: record.id,
      photoPending: false,
      updatedAt: record.updatedAt ?? 0,
    }
    diffs.push(diff)
    candidates.push({ diff, record })
  }
  if (candidates.length > 0 && collection === 'players') {
    await Promise.all(
      candidates.map(async ({ diff, record }) => {
        diff.photoPending = Boolean(await isPhotoPending(diff.id, record))
      })
    )
  }
  return diffs
}
