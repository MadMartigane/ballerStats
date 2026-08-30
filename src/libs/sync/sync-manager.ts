import { get, set } from 'idb-keyval'
import type PocketBase from 'pocketbase'
import { currentClub, currentRole, isLoggedIn } from '../auth/auth'
import Contact from '../contact/contact'
import bsEventBus from '../event-bus/event-bus'
import type { BsEventBusType } from '../event-bus/event-bus.d'
import MadSignal from '../mad-signal'
import Match from '../match/match'
import orchestrator from '../orchestrator/orchestrator'
import type { DomainDataset } from '../orchestrator/orchestrator.d'
import { getPhoto } from '../photo-store/photo-store'
import Player from '../player/player'
import { isAuthEnabled, pb } from '../pocketbase/client'
import Team from '../team/team'
import { toast } from '../utils/utils'
import { COLLECTION_CHANGE_EVENT, SYNC_COLLECTIONS } from './constants'
import { syncMetaStore } from './idb'
import { buildOutboxDiffs, computeWinners, deepEqual, firstSyncDecision, fromMatchRecord, isPbId } from './mapper'
import { enqueueOutboxItem } from './outbox'
import { downloadRemotePhoto, getFileAuthToken, movePhotoKey, shouldDownloadPhoto, shouldUploadPhoto } from './photos'
import type { PulledCollection, RawRecord } from './pull'
import { pullCollection } from './pull'
import { drainOutbox, type LeaseConflict, type PushContext } from './push'
import type { FirstSyncDecision, IdentityRewrites, RemoteRecord, SyncCollection, SyncMeta, SyncStatus } from './sync.d'

const META_KEY = 'syncMeta'

const DRAIN_DEBOUNCE_MS = 3000
const PULL_DEBOUNCE_MS = 2000
const ERROR_RETRY_MS = 45_000

export const syncStatus: MadSignal<SyncStatus> = new MadSignal<SyncStatus>('idle')
export const firstSyncPending: MadSignal<boolean> = new MadSignal(false)
export const lastSyncAt: MadSignal<number | null> = new MadSignal<number | null>(null)

interface SyncScan {
  raws: Record<SyncCollection, RawRecord[]>
  records: Record<SyncCollection, RemoteRecord[]>
  remoteTotal: number
}

export function emptySyncMeta(): SyncMeta {
  return {
    firstSyncResolved: false,
    idMap: { contacts: {}, matchs: {}, players: {}, teams: {} },
    lastPullAt: {},
    snapshot: { contacts: {}, matchs: {}, players: {}, teams: {} },
  }
}

async function loadMeta(): Promise<SyncMeta> {
  const stored = await get<SyncMeta>(META_KEY, syncMetaStore).catch(() => undefined)
  if (!stored) {
    return emptySyncMeta()
  }
  return {
    firstSyncResolved: Boolean(stored.firstSyncResolved),
    idMap: {
      contacts: stored.idMap?.contacts ?? {},
      matchs: stored.idMap?.matchs ?? {},
      players: stored.idMap?.players ?? {},
      teams: stored.idMap?.teams ?? {},
    },
    lastPullAt: stored.lastPullAt ?? {},
    snapshot: {
      contacts: stored.snapshot?.contacts ?? {},
      matchs: stored.snapshot?.matchs ?? {},
      players: stored.snapshot?.players ?? {},
      teams: stored.snapshot?.teams ?? {},
    },
  }
}

async function saveMeta(meta: SyncMeta): Promise<void> {
  await set(META_KEY, meta, syncMetaStore)
}

export class SyncManager {
  readonly #pb: PocketBase = pb
  #meta: SyncMeta = emptySyncMeta()
  #started = false
  #online = typeof navigator === 'undefined' ? true : navigator.onLine
  #applyingRemote = false
  #suppressCollect = false
  #busy = false
  #cycleRequested = false
  #drainTimer: ReturnType<typeof setTimeout> | undefined
  #errorRetryTimer: ReturnType<typeof setTimeout> | undefined
  #pullTimers: Partial<Record<SyncCollection, ReturnType<typeof setTimeout>>> = {}
  #listenerCleanups: Array<{ event: BsEventBusType; handler: () => void }> = []
  #windowCleanups: Array<{ type: 'online' | 'offline'; handler: () => void }> = []
  #unsubscribers: Array<() => void> = []
  readonly #droppedToasts = new Set<string>()
  readonly #leaseConflictToasts = new Set<string>()
  #pendingRemoteScan: SyncScan | null = null

  constructor(pbLike?: PocketBase) {
    if (pbLike) {
      this.#pb = pbLike
    }
  }

  get started(): boolean {
    return this.#started
  }

  /** Boots the sync loop after login; re-runs (idempotently) after a logout/login or club change. */
  async start(): Promise<void> {
    if (!isAuthEnabled || !isLoggedIn()) {
      return
    }
    await this.stop()
    this.#meta = await loadMeta()
    this.#started = true
    this.#installListeners()
    await this.syncNow()
  }

  async stop(): Promise<void> {
    this.#started = false
    this.#applyingRemote = false
    this.#suppressCollect = false
    for (const { event, handler } of this.#listenerCleanups) {
      bsEventBus.removeEventListener(event, handler)
    }
    this.#listenerCleanups = []
    for (const { type, handler } of this.#windowCleanups) {
      window.removeEventListener(type, handler)
    }
    this.#windowCleanups = []
    await Promise.all(
      this.#unsubscribers.map(async (unsub) => {
        try {
          await unsub()
        } catch {
          // best effort
        }
      })
    )
    this.#unsubscribers = []
    if (this.#drainTimer) {
      clearTimeout(this.#drainTimer)
      this.#drainTimer = undefined
    }
    if (this.#errorRetryTimer) {
      clearTimeout(this.#errorRetryTimer)
      this.#errorRetryTimer = undefined
    }
    for (const pullTimer of Object.values(this.#pullTimers)) {
      clearTimeout(pullTimer)
    }
    this.#pullTimers = {}
    firstSyncPending.set(false)
    syncStatus.set('idle')
  }

  /** Manual refresh (app-bar click) — pull, enqueue local diffs, drain. */
  async syncNow(): Promise<void> {
    if (!this.#isRunning() || !this.#isOnline() || !isLoggedIn() || !isAuthEnabled) {
      if (!this.#isOnline()) {
        syncStatus.set('offline')
      }
      return
    }
    if (this.#isBusy()) {
      this.#cycleRequested = true
      return
    }
    this.#busy = true
    try {
      await this.#runCycle()
    } finally {
      this.#busy = false
      if (this.#isCycleRequested()) {
        this.#cycleRequested = false
        this.syncNow()
      }
    }
  }

  /** First-sync conflict resolution chosen from the modal (French UI). */
  async resolveFirstSync(choice: Exclude<FirstSyncDecision, 'ask' | 'idle'>): Promise<void> {
    if (!firstSyncPending.get()) {
      return
    }
    try {
      if (choice === 'pull-remote') {
        // Never destroy local data without a backup: exportDB downloads a .bstat.
        try {
          await orchestrator.exportDB()
          toast('Sauvegarde locale téléchargée (fichier .bstat).', 'success')
        } catch {
          toast('Échec de la sauvegarde locale — récupération annulée.', 'error')
          return
        }
        const scan = this.#pendingRemoteScan
        if (scan) {
          await this.#adoptRemote(scan)
        }
      } else {
        // 'push-local': local wins, so push it BEFORE pulling anything back.
        this.#meta.firstSyncResolved = true
        await saveMeta(this.#meta)
        firstSyncPending.set(false)
        await this.#collectAll()
        await this.#drain()
        this.syncNow()
        return
      }
      this.#meta.firstSyncResolved = true
      await saveMeta(this.#meta)
      firstSyncPending.set(false)
      this.syncNow()
    } catch (err) {
      console.warn('[sync] resolveFirstSync failed:', err)
      syncStatus.set('error')
    }
  }

  async #runCycle(): Promise<void> {
    const club = currentClub.get()
    if (!club) {
      return
    }
    syncStatus.set('syncing')
    try {
      if (!this.#meta.firstSyncResolved) {
        await this.#resolveFirstSyncOnce(club.id)
        if (firstSyncPending.get() || !this.#meta.firstSyncResolved) {
          syncStatus.set('conflict')
          return
        }
      }
      await this.#pullAll(club.id)
      await this.#collectAll()
      const { aborted, remaining } = await this.#drain()
      this.#clearErrorRetry()
      lastSyncAt.set(Date.now())
      syncStatus.set(remaining > 0 ? 'pending' : 'synced')
      bsEventBus.dispatchEvent(aborted ? 'BS::SYNCHRO::FAIL' : 'BS::SYNCHRO::SUCCESS')
    } catch (err) {
      syncStatus.set('error')
      this.#scheduleErrorRetry()
      bsEventBus.dispatchEvent('BS::SYNCHRO::FAIL')
      console.warn('[sync] cycle failed:', err)
    }
  }

  async #resolveFirstSyncOnce(clubId: string): Promise<void> {
    const scan = await this.#pullAllInto(clubId)
    this.#pendingRemoteScan = scan
    const localTotal = this.#localTotal()
    const decision: FirstSyncDecision = firstSyncDecision(localTotal, scan.remoteTotal)
    if (decision === 'ask') {
      firstSyncPending.set(true)
      syncStatus.set('conflict')
      return
    }
    this.#meta.firstSyncResolved = true
    if (decision === 'pull-remote') {
      await this.#adoptRemote(scan)
    }
    // 'push-local' / 'idle': keep local data; the normal cycle below pushes it.
    await saveMeta(this.#meta)
  }

  async #pullAll(clubId: string): Promise<void> {
    await Promise.all(SYNC_COLLECTIONS.map((collection) => this.#pullAndApply(clubId, collection)))
  }

  async #pullAndApply(clubId: string, collection: SyncCollection): Promise<void> {
    const pulled = await pullCollection(this.#pb, collection, clubId)
    await this.#applyPulled(pulled)
  }

  async #pullAllInto(clubId: string): Promise<SyncScan> {
    const raws: Record<SyncCollection, RawRecord[]> = { contacts: [], matchs: [], players: [], teams: [] }
    const records: Record<SyncCollection, RemoteRecord[]> = { contacts: [], matchs: [], players: [], teams: [] }
    const pulled = await Promise.all(SYNC_COLLECTIONS.map((collection) => pullCollection(this.#pb, collection, clubId)))
    for (const item of pulled) {
      raws[item.collection] = item.raws
      records[item.collection] = item.records
    }
    const remoteTotal = pulled.reduce((total, item) => total + item.raws.length, 0)
    return { raws, records, remoteTotal }
  }

  /** LWW-merge one collection's remote records; no re-enqueue of remote winners. */
  async #applyPulled(pulled: PulledCollection): Promise<void> {
    const { collection, raws, records } = pulled
    this.#meta.lastPullAt[collection] = Date.now()
    const current = this.#currentRaw(collection)
    const winners = computeWinners(current, raws)
    const snapshotMap = this.#meta.snapshot[collection]
    if (winners.length > 0) {
      this.#applyingRemote = true
      try {
        orchestrator.applyRemote(this.#toDataset({ [collection]: winners }))
      } finally {
        this.#applyingRemote = false
      }
      for (const winner of winners) {
        if (winner.id) {
          snapshotMap[winner.id] = winner
        }
      }
    }
    // Server drift: a remote record that lost the LWW merge (older updatedAt)
    // but differs from the snapshot means the server copy changed under us.
    // Snapshot it so the collector re-queues the local record for push.
    const winnerIds = new Set(winners.map((winner) => winner.id))
    for (const remote of raws) {
      if (remote.id && !winnerIds.has(remote.id)) {
        const baseline = snapshotMap[remote.id]
        if (baseline && !deepEqual(baseline, remote)) {
          snapshotMap[remote.id] = remote
        }
      }
    }
    const idMap = this.#meta.idMap[collection]
    for (const record of records) {
      idMap[record.id] = record.id
    }
    if (collection === 'players' && records.length > 0) {
      await this.#downloadMissingPlayerPhotos(records)
    }
    await saveMeta(this.#meta)
  }

  #toDataset(rawsByCollection: Partial<Record<SyncCollection, RawRecord[]>>): DomainDataset {
    const players = rawsByCollection.players ?? []
    const teams = rawsByCollection.teams ?? []
    const matchs = rawsByCollection.matchs ?? []
    const contacts = rawsByCollection.contacts ?? []
    return {
      contacts: contacts.length > 0 ? contacts.map((raw) => new Contact(raw)) : undefined,
      matchs: matchs.length > 0 ? matchs.map((raw) => new Match(raw)) : undefined,
      players: players.length > 0 ? players.map((raw) => new Player(raw)) : undefined,
      teams: teams.length > 0 ? teams.map((raw) => new Team(raw)) : undefined,
    }
  }

  async #adoptRemote(scan: SyncScan): Promise<void> {
    this.#applyingRemote = true
    try {
      orchestrator.replaceDataset(this.#toDataset(scan.raws))
    } finally {
      this.#applyingRemote = false
    }
    for (const collection of SYNC_COLLECTIONS) {
      const snapshotMap = this.#meta.snapshot[collection]
      const idMap = this.#meta.idMap[collection]
      for (const raw of scan.raws[collection]) {
        if (raw.id) {
          snapshotMap[raw.id] = raw
          idMap[raw.id] = raw.id
        }
      }
    }
    await this.#downloadMissingPlayerPhotos(scan.records.players)
  }

  async #downloadMissingPlayerPhotos(records: RemoteRecord[]): Promise<void> {
    const token = await getFileAuthToken(this.#pb)
    await Promise.all(
      records.map(async (record) => {
        try {
          if (!record.hasPhoto) {
            return
          }
          const localBlob = await getPhoto(record.id)
          if (!shouldDownloadPhoto({ localHasBlob: Boolean(localBlob), remoteHasPhoto: true })) {
            return
          }
          await downloadRemotePhoto(this.#pb, record, token)
        } catch (err) {
          console.warn(`[sync] photo download failed for ${record.id}:`, err)
        }
      })
    )
  }

  #installListeners(): void {
    for (const collection of SYNC_COLLECTIONS) {
      const event = COLLECTION_CHANGE_EVENT[collection]
      const handler = () => {
        this.#onLocalChange(collection)
      }
      bsEventBus.addEventListener(event, handler)
      this.#listenerCleanups.push({ event, handler })
    }

    this.#addWindowListener('online', () => {
      this.#online = true
      this.syncNow()
    })
    this.#addWindowListener('offline', () => {
      this.#online = false
      syncStatus.set('offline')
    })

    this.#subscribeRealtime()
  }

  #addWindowListener(type: 'online' | 'offline', handler: () => void): void {
    window.addEventListener(type, handler)
    this.#windowCleanups.push({ handler, type })
  }

  async #subscribeRealtime(): Promise<void> {
    const club = currentClub.get()
    if (!club) {
      return
    }
    await Promise.all(
      SYNC_COLLECTIONS.map(async (collection) => {
        try {
          const unsub = await this.#pb.collection(collection).subscribe(collection, () => {
            this.#schedulePull()
          })
          this.#unsubscribers.push(unsub)
        } catch (err) {
          console.warn(`[sync] realtime subscribe failed for ${collection}:`, err)
        }
      })
    )
  }

  #schedulePull(): void {
    if (!this.#isRunning() || !this.#isOnline() || !isLoggedIn()) {
      return
    }
    for (const collection of SYNC_COLLECTIONS) {
      const timer = this.#pullTimers[collection]
      if (timer) {
        clearTimeout(timer)
      }
      this.#pullTimers[collection] = setTimeout(() => {
        delete this.#pullTimers[collection]
        this.syncNow()
      }, PULL_DEBOUNCE_MS)
    }
  }

  #onLocalChange(collection: SyncCollection): void {
    if (
      !this.#isRunning() ||
      !this.#isOnline() ||
      !isLoggedIn() ||
      this.#isApplyingRemote() ||
      this.#isSuppressingCollect()
    ) {
      return
    }
    syncStatus.set('pending')
    this.#collectCollection(collection)
  }

  async #collectCollection(collection: SyncCollection): Promise<void> {
    if (this.#isApplyingRemote() || this.#isSuppressingCollect()) {
      return
    }
    const current = this.#currentRaw(collection)
    const diffs = await buildOutboxDiffs(collection, current, this.#meta.snapshot[collection], (recordId, record) =>
      this.#shouldUploadPhoto(recordId, record)
    )
    if (diffs.length === 0) {
      return
    }
    await Promise.all(diffs.map((diff) => enqueueOutboxItem(diff)))
    this.#scheduleDrain()
  }

  async #collectAll(): Promise<void> {
    await Promise.all(SYNC_COLLECTIONS.map((collection) => this.#collectCollection(collection)))
  }

  async #shouldUploadPhoto(recordId: string, record: RawRecord): Promise<boolean> {
    const snapshotRecord = this.#meta.snapshot.players[recordId]
    return shouldUploadPhoto({
      localHasBlob: Boolean(await getPhoto(recordId)),
      localHasPhoto: Boolean((record as { hasPhoto?: boolean }).hasPhoto),
      snapshotHasPhoto: Boolean(snapshotRecord?.hasPhoto),
    })
  }

  #scheduleDrain(): void {
    if (this.#drainTimer) {
      clearTimeout(this.#drainTimer)
    }
    this.#drainTimer = setTimeout(() => {
      this.#drainTimer = undefined
      this.syncNow()
    }, DRAIN_DEBOUNCE_MS)
  }

  #currentRaw(collection: SyncCollection): RawRecord[] {
    switch (collection) {
      case 'players':
        return orchestrator.Players.getRawData()
      case 'teams':
        return orchestrator.Teams.getRawData()
      case 'matchs':
        return orchestrator.Matchs.getRawData()
      case 'contacts':
        return orchestrator.Contacts.getRawData()
      default:
        // Exhaustive over the closed SyncCollection union.
        return []
    }
  }

  #isRunning(): boolean {
    return this.#started
  }

  #isOnline(): boolean {
    return this.#online
  }

  #isBusy(): boolean {
    return this.#busy
  }

  #isCycleRequested(): boolean {
    return this.#cycleRequested
  }

  #isApplyingRemote(): boolean {
    return this.#applyingRemote
  }

  #isSuppressingCollect(): boolean {
    return this.#suppressCollect
  }

  #localTotal(): number {
    return SYNC_COLLECTIONS.reduce((total, collection) => total + this.#currentRaw(collection).length, 0)
  }

  async #drain(): Promise<{ aborted: boolean; remaining: number }> {
    const club = currentClub.get()
    if (!club) {
      return { aborted: false, remaining: 0 }
    }
    const context: PushContext = {
      clubId: club.id,
      idMap: this.#meta.idMap,
      onDropped: (collection, id) => this.#onItemDropped(collection, id),
      onIdentityRewrites: (rewrites, photoMoves) => this.#applyIdentityRewrites(rewrites, photoMoves),
      onItemPushed: (pushed) => this.#snapshotPushedItem(pushed),
      onLeaseConflict: (conflict) => this.#onLeaseConflict(conflict),
      onWarn: (message) => console.warn(`[sync/push] ${message}`),
      photoGetter: (primaryId, secondaryId) => this.#getPhotoFallback(primaryId, secondaryId),
      resolvePlayerTeamPbIds: (playerId) => this.#resolvePlayerTeamPbIds(playerId),
      resolveRaw: (collection, id) => this.#resolveRaw(collection, id),
      role: currentRole.get(),
    }
    const result = await drainOutbox(this.#pb, context)
    await saveMeta(this.#meta)
    return result
  }

  #resolveRaw(collection: SyncCollection, id: string): RawRecord | null {
    switch (collection) {
      case 'players':
        return orchestrator.getPlayer(id)?.getRawData() ?? null
      case 'teams':
        return orchestrator.getTeam(id)?.getRawData() ?? null
      case 'matchs':
        return orchestrator.getMatch(id)?.getRawData() ?? null
      case 'contacts':
        return orchestrator.Contacts.getRawData().find((candidate) => candidate.id === id) ?? null
      default:
        // Exhaustive over the closed SyncCollection union.
        return null
    }
  }

  #resolvePlayerTeamPbIds(playerId: string): string[] {
    return orchestrator.Teams.getRawData()
      .filter((team) => (team.playerIds ?? []).includes(playerId))
      .map((team) => (team.id ? (this.#meta.idMap.teams[team.id] ?? team.id) : team.id))
      .filter((teamId): teamId is string => isPbId(teamId))
  }

  /** Applies a server-generated id locally (rewrites FKs) and moves the photo blob. */
  async #applyIdentityRewrites(rewrites: IdentityRewrites, photoMoves: [string, string][]): Promise<void> {
    for (const entry of Object.entries(rewrites)) {
      const collection = entry[0] as SyncCollection
      const idMap = this.#meta.idMap[collection]
      for (const [localId, newId] of Object.entries(entry[1] as Record<string, string>)) {
        idMap[localId] = newId
        idMap[newId] = newId
      }
    }
    this.#suppressCollect = true
    try {
      orchestrator.rewriteIdentities(rewrites)
    } finally {
      this.#suppressCollect = false
    }
    await Promise.all(photoMoves.map(([from, to]) => movePhotoKey(from, to)))
  }

  /** The snapshot tracks what the server knows, so pushed records are not re-queued. */
  #snapshotPushedItem(pushed: { collection: SyncCollection; localId: string; pbId: string; raw: RawRecord }): void {
    const snapshotMap = this.#meta.snapshot[pushed.collection]
    if (pushed.pbId !== pushed.localId) {
      delete snapshotMap[pushed.localId]
    }
    snapshotMap[pushed.pbId] = pushed.raw
  }

  #onItemDropped(collection: SyncCollection, id: string): void {
    const key = `${collection}:${id}`
    if (this.#droppedToasts.has(key)) {
      return
    }
    this.#droppedToasts.add(key)
    // push.ts already warned with the reason; toast once to avoid nagging.
    toast('Un élément ne peut pas être synchronisé (abandonné après 5 tentatives).', 'error')
  }

  /** Blob lookup after a possible id rewrite: post-rewrite key first, legacy key as fallback. */
  async #getPhotoFallback(primaryId: string, secondaryId?: string): Promise<Blob | undefined> {
    const primary = await getPhoto(primaryId)
    if (primary) {
      return primary
    }
    return secondaryId ? getPhoto(secondaryId) : undefined
  }

  /** The server rejected a push (scoring lease): adopt its copy, toast once. */
  async #onLeaseConflict(conflict: LeaseConflict): Promise<void> {
    const toastKey = `${conflict.collection}:${conflict.localId}`
    if (!this.#leaseConflictToasts.has(toastKey)) {
      this.#leaseConflictToasts.add(toastKey)
      toast("Match saisi par quelqu'un d'autre — version serveur conservée.", 'warning')
    }
    if (conflict.collection !== 'matchs') {
      return
    }
    try {
      const serverRecord = (await this.#pb
        .collection(conflict.collection)
        .getOne(conflict.pbId)) as unknown as RemoteRecord
      const raw = fromMatchRecord(serverRecord)
      this.#applyingRemote = true
      try {
        orchestrator.overwriteById({ matchs: [new Match(raw)] })
      } finally {
        this.#applyingRemote = false
      }
      const snapshotMap = this.#meta.snapshot[conflict.collection]
      if (conflict.pbId !== conflict.localId) {
        delete snapshotMap[conflict.localId]
      }
      snapshotMap[conflict.pbId] = raw
      await saveMeta(this.#meta)
    } catch (err) {
      console.warn('[sync] lease-conflict reconcile failed:', err)
    }
  }

  /** While the status is error, silently retry the cycle every ~45s. */
  #scheduleErrorRetry(): void {
    this.#clearErrorRetry()
    this.#errorRetryTimer = setTimeout(() => {
      this.#errorRetryTimer = undefined
      if (this.#isRunning() && this.#isOnline() && isLoggedIn()) {
        this.syncNow()
      }
    }, ERROR_RETRY_MS)
  }

  #clearErrorRetry(): void {
    if (this.#errorRetryTimer) {
      clearTimeout(this.#errorRetryTimer)
      this.#errorRetryTimer = undefined
    }
  }
}

export const syncManager = new SyncManager()
