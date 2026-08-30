import { strToU8, unzip, zip } from 'fflate'
import Contact from '../contact/contact'
import Contacts from '../contacts/contacts'
import bsEventBus from '../event-bus/event-bus'
import Match from '../match/match'
import Matchs from '../matchs/matchs'
import {
  clearAllPhotos,
  deletePhoto,
  getAllPhotoEntries,
  hasPhoto,
  PHOTO_FILE_EXTENSION,
  PHOTO_MIME_TYPE,
  storePhoto,
} from '../photo-store/photo-store'
import Player, { sortPlayersByJersey } from '../player/player'
import Players from '../players/players'
import { soundTab } from '../sounds/tab'
import {
  getStoredContacts,
  getStoredMatchs,
  getStoredPlayers,
  getStoredTeams,
  storeContacts,
  storeMatchs,
  storePlayers,
  storeTeams,
} from '../store/store'
import Team from '../team/team'
import Teams from '../teams/teams'
import { DEFAULT_TITLES, persistTitles, titles } from '../trombi-titles-store'
import { confirmAction, downloadBlob, toast } from '../utils/utils'
import { vibrate } from '../vibrator/vibrator'
import type { ThemeVibration } from '../vibrator/vibrator.d'
import type { DomainDataset, GlobalDB } from './orchestrator.d'

export const DB_FILE_EXTENSION = '.bstat' as const

const THEME_VIBRATION_TO_DURATION: { [key in ThemeVibration]: number } = {
  double: 100,
  long: 200,
  single: 100,
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

/**
 * Per-record last-write-wins merge: for each incoming item, keep the copy with
 * the higher `updatedAt` (legacy data without it counts as 0); on ties keep the
 * in-memory (`current`) copy. Returns `current` itself when nothing changed.
 */
export function mergeByUpdatedAt<T extends { id?: string; updatedAt?: number }>(current: T[], incoming: T[]): T[] {
  if (incoming.length === 0) {
    return current
  }

  const merged = [...current]
  let changed = false

  for (const item of incoming) {
    const existingIndex = merged.findIndex((existing) => existing.id !== undefined && existing.id === item.id)
    if (existingIndex === -1) {
      merged.push(item)
      changed = true
    } else if ((item.updatedAt ?? 0) > (merged[existingIndex].updatedAt ?? 0)) {
      merged[existingIndex] = item
      changed = true
    }
  }

  return changed ? merged : current
}

/** Highest `updatedAt` among items — the stored envelope's `lastRecord`. */
function maxUpdatedAt<T extends { updatedAt?: number }>(items: T[]): number {
  let max = 0
  for (const item of items) {
    const timestamp = item.updatedAt ?? 0
    if (timestamp > max) {
      max = timestamp
    }
  }
  return max
}

/**
 * Runtime shape check for archives parsed from JSON. `JSON.parse` results are
 * cast to `GlobalDB` at the call sites, but a malformed archive can omit keys
 * that the type declares as non-optional (e.g. `players`), so the cast alone
 * cannot guarantee the shape. This guard rejects such archives before any
 * field access, keeping the import flow on its friendly error path.
 */
export function isGlobalDB(value: unknown): value is GlobalDB {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    Boolean(candidate.timestamp) &&
    Array.isArray(candidate.players) &&
    Array.isArray(candidate.matchs) &&
    Array.isArray(candidate.teams) &&
    (candidate.contacts === undefined || candidate.contacts === null || Array.isArray(candidate.contacts))
  )
}

export class Orchestrator {
  #players: Players = new Players()
  #teams = new Teams()
  #matchs = new Matchs()
  #contacts = new Contacts()

  constructor() {
    this.getStoredPlayers()
    this.getStoredTeams()
    this.getStoredMatchs()
    this.getStoredContacts()
    this.installEventHandlers()
  }

  private installEventHandlers() {
    bsEventBus.addEventListener('BS::PLAYERS::CHANGE', () => {
      this.storePlayers()
    })

    bsEventBus.addEventListener('BS::TEAMS::CHANGE', () => {
      this.storeTeams()
    })

    bsEventBus.addEventListener('BS::MATCHS::CHANGE', () => {
      this.storeMatchs()
    })

    bsEventBus.addEventListener('BS::CONTACTS::CHANGE', () => {
      this.storeContacts()
    })
  }

  private storePlayers() {
    const rawData = this.#players.getRawData()

    storePlayers(rawData, maxUpdatedAt(rawData))
      .then(() => {
        this.throwSynchroSuccessEvent()
      })
      .catch(() => {
        this.throwSynchroFailEvent()
      })
  }

  private storeTeams() {
    const rawData = this.#teams.getRawData()

    storeTeams(rawData, maxUpdatedAt(rawData))
      .then(() => {
        this.throwSynchroSuccessEvent()
      })
      .catch(() => {
        this.throwSynchroFailEvent()
      })
  }

  private storeMatchs() {
    const rawData = this.#matchs.getRawData()

    storeMatchs(rawData, maxUpdatedAt(rawData))
      .then(() => {
        this.throwSynchroSuccessEvent()
      })
      .catch(() => {
        this.throwSynchroFailEvent()
      })
  }

  private storeContacts() {
    const rawData = this.#contacts.getRawData()

    storeContacts(rawData, maxUpdatedAt(rawData))
      .then(() => {
        this.throwSynchroSuccessEvent()
      })
      .catch(() => {
        this.throwSynchroFailEvent()
      })
  }

  private async getStoredPlayers() {
    const stored = await getStoredPlayers().catch(() => {
      this.throwSynchroFailEvent()
    })

    if (!stored) {
      this.throwSynchroSuccessEvent()
      return
    }

    // Per-record LWW merge: higher updatedAt wins, ties keep the in-memory copy.
    const current = this.#players.getRawData()
    const merged = mergeByUpdatedAt(current, stored.data)
    if (merged !== current) {
      this.#players = new Players(merged)
      this.throwPlayersUpdatedEvent()
    }
  }

  private async getStoredTeams() {
    const stored = await getStoredTeams().catch(() => {
      this.throwSynchroFailEvent()
    })

    if (!stored) {
      this.throwSynchroSuccessEvent()
      return
    }

    // Per-record LWW merge: higher updatedAt wins, ties keep the in-memory copy.
    const current = this.#teams.getRawData()
    const merged = mergeByUpdatedAt(current, stored.data)
    if (merged !== current) {
      this.#teams = new Teams(merged)
      this.throwTeamsUpdatedEvent()
    }
  }

  private async getStoredMatchs() {
    const stored = await getStoredMatchs().catch(() => {
      this.throwSynchroFailEvent()
    })

    if (!stored) {
      this.throwSynchroSuccessEvent()
      return
    }

    // Per-record LWW merge: higher updatedAt wins, ties keep the in-memory copy.
    const current = this.#matchs.getRawData()
    const merged = mergeByUpdatedAt(current, stored.data)
    if (merged !== current) {
      this.#matchs = new Matchs(merged)
      this.throwMatchsUpdatedEvent()
    }
  }

  private async getStoredContacts() {
    const stored = await getStoredContacts().catch(() => {
      this.throwSynchroFailEvent()
    })

    if (!stored) {
      this.throwSynchroSuccessEvent()
      return
    }

    // Per-record LWW merge: higher updatedAt wins, ties keep the in-memory copy.
    const current = this.#contacts.getRawData()
    const merged = mergeByUpdatedAt(current, stored.data)
    if (merged !== current) {
      this.#contacts = new Contacts(merged)
      this.throwContactsUpdatedEvent()
    }
  }

  private clearCollectionsOnly(): void {
    this.Players.clear()
    this.Teams.clear()
    this.Matchs.clear()
    this.Contacts.clear()
  }

  /** Append, or per-id LWW-merge, incoming entities into the in-memory collections. */
  private addAll(dataset: DomainDataset): void {
    this.#players = new Players(
      mergeByUpdatedAt(
        this.#players.getRawData(),
        (dataset.players ?? []).map((player) => player.getRawData())
      )
    )
    this.#teams = new Teams(
      mergeByUpdatedAt(
        this.#teams.getRawData(),
        (dataset.teams ?? []).map((team) => team.getRawData())
      )
    )
    this.#matchs = new Matchs(
      mergeByUpdatedAt(
        this.#matchs.getRawData(),
        (dataset.matchs ?? []).map((match) => match.getRawData())
      )
    )
    this.#contacts = new Contacts(
      mergeByUpdatedAt(
        this.#contacts.getRawData(),
        (dataset.contacts ?? []).map((contact) => contact.getRawData())
      )
    )

    if ((dataset.players ?? []).length > 0) {
      this.throwPlayersUpdatedEvent()
    }
    if ((dataset.teams ?? []).length > 0) {
      this.throwTeamsUpdatedEvent()
    }
    if ((dataset.matchs ?? []).length > 0) {
      this.throwMatchsUpdatedEvent()
    }
    if ((dataset.contacts ?? []).length > 0) {
      this.throwContactsUpdatedEvent()
    }
  }

  private async doClearDB() {
    this.clearCollectionsOnly()
    await persistTitles({ ...DEFAULT_TITLES })
    await clearAllPhotos()
  }

  private async doOverwriteDB(json: GlobalDB) {
    this.addAll({
      contacts: (json.contacts ?? []).map((c) => new Contact(c)),
      matchs: json.matchs.map((m) => new Match(m)),
      players: json.players.map((p) => new Player(p)),
      teams: json.teams.map((t) => new Team(t)),
    })
    await persistTitles(json.trombiTitles ?? { ...DEFAULT_TITLES })
  }

  get Players() {
    return this.#players
  }

  get Teams() {
    return this.#teams
  }

  get Matchs() {
    return this.#matchs
  }

  get Contacts() {
    return this.#contacts
  }

  throwPlayersUpdatedEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::PLAYERS::CHANGE', mute)
  }

  throwTeamsUpdatedEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::TEAMS::CHANGE', mute)
  }

  throwMatchsUpdatedEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::MATCHS::CHANGE', mute)
  }

  throwContactsUpdatedEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::CONTACTS::CHANGE', mute)
  }

  throwSynchroSuccessEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::SYNCHRO::SUCCESS', mute)
  }

  throwSynchroFailEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::SYNCHRO::FAIL', mute)
  }

  getPlayer(id?: string | null) {
    if (!id) {
      return null
    }

    return this.#players.players.find((candidate) => candidate.id === id) || null
  }

  getTeam(id?: string | null) {
    if (!id) {
      return null
    }

    return this.#teams.teams.find((candidate) => candidate.id === id) || null
  }

  getMatch(id?: string | null) {
    if (!id) {
      return null
    }

    return this.#matchs.matchs.find((candidate) => candidate.id === id) || null
  }

  /** Atomically replace all domain data with the given dataset. */
  replaceDataset(dataset: DomainDataset): void {
    this.clearCollectionsOnly()
    this.addAll(dataset)
  }

  /**
   * LWW-merge server data into the in-memory collections (see `addAll`).
   * Exposed for the sync pull path; change events still fire so the UI
   * refreshes, and the sync manager guards its own collectors against echo.
   */
  applyRemote(dataset: DomainDataset): void {
    this.addAll(dataset)
  }

  /**
   * Overrides records whose id matches the incoming server data (no LWW merge),
   * keeping every other record untouched. Used when the server rejected a local
   * write (scoring lease) so its copy becomes authoritative locally.
   */
  overwriteById(dataset: DomainDataset): void {
    const incomingPlayers = new Map((dataset.players ?? []).map((player) => [player.id, player.getRawData()]))
    const incomingTeams = new Map((dataset.teams ?? []).map((team) => [team.id, team.getRawData()]))
    const incomingMatchs = new Map((dataset.matchs ?? []).map((match) => [match.id, match.getRawData()]))
    const incomingContacts = new Map((dataset.contacts ?? []).map((contact) => [contact.id, contact.getRawData()]))

    if (incomingPlayers.size > 0) {
      this.#players = new Players(
        this.#players.getRawData().map((raw) => (raw.id ? (incomingPlayers.get(raw.id) ?? raw) : raw))
      )
    }
    if (incomingTeams.size > 0) {
      this.#teams = new Teams(
        this.#teams.getRawData().map((raw) => (raw.id ? (incomingTeams.get(raw.id) ?? raw) : raw))
      )
      this.throwTeamsUpdatedEvent()
    }
    if (incomingMatchs.size > 0) {
      this.#matchs = new Matchs(
        this.#matchs.getRawData().map((raw) => (raw.id ? (incomingMatchs.get(raw.id) ?? raw) : raw))
      )
      this.throwMatchsUpdatedEvent()
    }
    if (incomingContacts.size > 0) {
      this.#contacts = new Contacts(
        this.#contacts.getRawData().map((raw) => (raw.id ? (incomingContacts.get(raw.id) ?? raw) : raw))
      )
      this.throwContactsUpdatedEvent()
    }
  }

  /**
   * Re-keys local records after PocketBase created them server-side (legacy
   * numeric-string ids are not valid PB ids). Rewrites every foreign key:
   * team.playerIds, match teamId/playersInTheFive/stats[].playerId and
   * contact.playerId. Identity changes do not bump updatedAt.
   */
  rewriteIdentities(rewrites: {
    players?: Record<string, string>
    teams?: Record<string, string>
    matchs?: Record<string, string>
    contacts?: Record<string, string>
  }): void {
    const playerMap = rewrites.players ?? {}
    const teamMap = rewrites.teams ?? {}
    const matchMap = rewrites.matchs ?? {}
    const contactMap = rewrites.contacts ?? {}
    const playerCount = Object.keys(playerMap).length
    const teamCount = Object.keys(teamMap).length
    const matchCount = Object.keys(matchMap).length
    const contactCount = Object.keys(contactMap).length

    if (playerCount > 0) {
      // Players' constructor dispatches BS::PLAYERS::CHANGE via setFromRawData,
      // so the UI refreshes exactly once (echo-safe for the sync collector).
      this.#players = new Players(
        this.#players.getRawData().map((raw) => {
          const id = raw.id ? (playerMap[raw.id] ?? raw.id) : raw.id
          return id === raw.id ? raw : { ...raw, id }
        })
      )
    }
    if (teamCount > 0 || playerCount > 0) {
      this.#teams = new Teams(
        this.#teams.getRawData().map((raw) => {
          const id = raw.id ? (teamMap[raw.id] ?? raw.id) : raw.id
          const playerIds = (raw.playerIds ?? []).map((playerId) => playerMap[playerId] ?? playerId)
          return id === raw.id ? { ...raw, playerIds } : { ...raw, id, playerIds }
        })
      )
      this.throwTeamsUpdatedEvent()
    }
    if (matchCount > 0 || teamCount > 0 || playerCount > 0) {
      this.#matchs = new Matchs(
        this.#matchs.getRawData().map((raw) => {
          const id = raw.id ? (matchMap[raw.id] ?? raw.id) : raw.id
          const teamId = raw.teamId ? (teamMap[raw.teamId] ?? raw.teamId) : null
          const playersInTheFive = (raw.playersInTheFive ?? []).map((playerId) => playerMap[playerId] ?? playerId)
          const stats = (raw.stats ?? []).map((entry) =>
            entry.playerId ? { ...entry, playerId: playerMap[entry.playerId] ?? entry.playerId } : entry
          )
          return id === raw.id
            ? { ...raw, playersInTheFive, stats, teamId }
            : { ...raw, id, playersInTheFive, stats, teamId }
        })
      )
      this.throwMatchsUpdatedEvent()
    }
    if (contactCount > 0 || playerCount > 0) {
      this.#contacts = new Contacts(
        this.#contacts.getRawData().map((raw) => {
          const id = raw.id ? (contactMap[raw.id] ?? raw.id) : raw.id
          const playerId = raw.playerId ? (playerMap[raw.playerId] ?? raw.playerId) : raw.playerId
          return id === raw.id ? { ...raw, playerId } : { ...raw, id, playerId }
        })
      )
      this.throwContactsUpdatedEvent()
    }
  }

  get hasAnyData(): boolean {
    return (
      this.#players.players.length > 0 ||
      this.#teams.teams.length > 0 ||
      this.#matchs.matchs.length > 0 ||
      this.#contacts.contacts.length > 0
    )
  }

  private cleanOrphans<T extends { id: string }>(
    items: T[],
    isOrphan: (item: T) => boolean,
    remove: (item: T) => void,
    notify: () => void
  ) {
    let cleaned = false
    for (const item of items) {
      if (isOrphan(item)) {
        remove(item)
        cleaned = true
      }
    }
    if (cleaned) {
      notify()
    }
  }

  bigClean() {
    let cleaned = false
    for (const team of this.Teams.teams) {
      const cleanPlayerIds = team.playerIds.filter((playerId) => Boolean(this.getPlayer(playerId)))

      if (team.playerIds.length > cleanPlayerIds.length) {
        team.update({ playerIds: cleanPlayerIds })
        this.Teams.updateTeam(team)
        cleaned = true
      }
    }

    if (cleaned) {
      this.throwTeamsUpdatedEvent()
    }

    this.cleanOrphans(
      this.Contacts.contacts,
      (contact) => !this.getPlayer(contact.playerId),
      (contact) => this.Contacts.removeSilent(contact),
      () => this.throwContactsUpdatedEvent()
    )
  }

  getJerseySortedPlayers(playerIds?: string[]): Player[] {
    if (!playerIds) {
      return []
    }

    const players = playerIds.map((playerId) => this.getPlayer(playerId)).filter((p): p is Player => p !== null)

    return sortPlayersByJersey(players)
  }

  async exportDB() {
    const date = new Date()

    const globalDB: GlobalDB = {
      contacts: this.Contacts.getRawData(),
      matchs: this.Matchs.getRawData(),
      players: this.Players.getRawData(),
      teams: this.Teams.getRawData(),
      timestamp: date.getTime(),
      trombiTitles: titles,
    }

    const files: Record<string, Uint8Array> = {
      'data.json': strToU8(JSON.stringify(globalDB)),
    }

    const photoEntries = await getAllPhotoEntries()
    const photoDatas = await Promise.all(
      photoEntries.map(async (entry) => {
        const buffer = await entry.blob.arrayBuffer()
        return { data: new Uint8Array(buffer), filePath: `photos/${entry.playerId}${PHOTO_FILE_EXTENSION}` }
      })
    )
    for (const { data, filePath } of photoDatas) {
      files[filePath] = data
    }

    const zipped = await new Promise<Uint8Array>((resolve, reject) => {
      zip(files, (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })
    })

    // Copy into a concrete ArrayBuffer-backed view so the part satisfies BlobPart
    // (TS 5.7+ generic TypedArrays); the copy preserves the exact zip bytes.
    const blob = new Blob([new Uint8Array(zipped)], { type: 'application/octet-stream' })
    const fileName = `baller-stats-export-db-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}${DB_FILE_EXTENSION}`
    downloadBlob(blob, fileName)
  }

  private async tryParseZip(uint8: Uint8Array): Promise<{ rawData: GlobalDB; photos: Map<string, Blob> } | null> {
    let unzipped: Record<string, Uint8Array>
    try {
      unzipped = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
        unzip(uint8, (err, data) => {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
      })
    } catch {
      // Not a valid zip — signal that caller should try legacy JSON fallback
      return null
    }

    const dataJson = unzipped['data.json']
    if (!dataJson) {
      throw new ParseError('Missing data.json in archive')
    }

    const decoder = new TextDecoder()
    const rawData: unknown = JSON.parse(decoder.decode(dataJson))

    if (!isGlobalDB(rawData)) {
      throw new ParseError('Invalid archive data')
    }

    const photos = new Map<string, Blob>()
    const correctedPlayers = rawData.players.map((playerData) => {
      if (!playerData.id || !playerData.hasPhoto) {
        return playerData
      }
      const photoPath = `photos/${playerData.id}${PHOTO_FILE_EXTENSION}`
      const photoData = unzipped[photoPath]
      if (photoData) {
        photos.set(playerData.id, new Blob([new Uint8Array(photoData)], { type: PHOTO_MIME_TYPE }))
        return playerData
      }
      // Photo referenced in metadata but missing from archive — correct the flag
      return { ...playerData, hasPhoto: false }
    })

    return { photos, rawData: { ...rawData, players: correctedPlayers } }
  }

  private async parseImportData(uint8: Uint8Array): Promise<{ rawData: GlobalDB; photos?: Map<string, Blob> }> {
    // Try ZIP format first
    const zipResult = await this.tryParseZip(uint8)
    if (zipResult) {
      return zipResult
    }

    // Legacy JSON fallback
    const text = new TextDecoder().decode(uint8)
    const rawData: unknown = JSON.parse(text)

    if (!isGlobalDB(rawData)) {
      throw new ParseError('Invalid archive data')
    }

    return { rawData }
  }

  private async readImportFile(
    event: Event & {
      currentTarget: HTMLInputElement
      target: HTMLInputElement
    }
  ): Promise<Uint8Array> {
    const input = event.target || event.currentTarget
    const files = input?.files
    if (!files?.[0]) {
      throw new Error('No file selected')
    }
    const buffer = await files[0].arrayBuffer()
    return new Uint8Array(buffer)
  }

  private async executeImport(rawData: GlobalDB, photos?: Map<string, Blob>): Promise<void> {
    await this.doOverwriteDB(rawData)

    if (!photos || photos.size === 0) {
      return
    }

    let photosError: Error | undefined
    try {
      const photoPromises = [...photos].map(([playerId, blob]) => this.Photos.store(playerId, blob))
      await Promise.all(photoPromises)
    } catch (err) {
      photosError = err instanceof Error ? err : new Error(String(err))
      console.error('executeImport: photos storage failed:', photosError)
    }

    if (photosError) {
      toast("Données importées mais certaines photos n'ont pas pu être restaurées.", 'error')
    }
  }

  async importDB(
    event: Event & {
      currentTarget: HTMLInputElement
      target: HTMLInputElement
    }
  ) {
    let uint8: Uint8Array
    try {
      uint8 = await this.readImportFile(event)
    } catch (error) {
      console.error('importDB: file read failed:', error)
      toast('Impossible de lire les données.', 'error')
      return
    }

    let parseResult: { rawData: GlobalDB; photos?: Map<string, Blob> }
    try {
      parseResult = await this.parseImportData(uint8)
    } catch (error) {
      console.error('importDB: parse failed:', error)
      toast('Données non valides.', 'error')
      return
    }

    const { rawData, photos } = parseResult

    const proced = await confirmAction(
      'Import DB',
      `Vous êtes sur le point d\u2019importer ${rawData.players.length || 0} joueurs, ${rawData.teams.length || 0} équipes, ${rawData.matchs.length || 0} matchs et ${rawData.contacts?.length || 0} contacts.`
    )
    if (!proced) {
      return
    }

    const cleanUpBefore = await confirmAction('Import DB', 'Voulez-vous écraser toutes les données ?')
    if (cleanUpBefore) {
      await this.doClearDB()
    }

    try {
      await this.executeImport(rawData, photos)
      toast('Import des nouvelles données réussi !', 'success')
    } catch (error) {
      console.error('importDB: executeImport failed:', error)
      toast("Impossible d'importer les données.", 'error')
    }
  }

  get Photos() {
    return {
      delete: async (playerId: string) => {
        await deletePhoto(playerId)
        const player = this.getPlayer(playerId)
        if (player) {
          player.hasPhoto = false
          this.Players.updatePlayer(player)
        }
      },
      getAll: getAllPhotoEntries,
      hasPhoto,
      store: async (playerId: string, blob: Blob) => {
        await storePhoto(playerId, blob)
        const player = this.getPlayer(playerId)
        if (player) {
          player.hasPhoto = true
          this.Players.updatePlayer(player)
        }
      },
    }
  }

  blink(duration: number): Promise<void> {
    const main = document.querySelector('main')
    return new Promise((resolve) => {
      if (!main) {
        console.warn('[Orchestrator.blink()] Unable to find the <main /> in the DOM.')
        resolve()
        return
      }

      main.classList.toggle('bg-amber-400/40')
      return setTimeout(() => {
        main.classList.toggle('bg-amber-400/40')
        resolve()
      }, duration)
    })
  }

  throwUserActionFeedback(theme: ThemeVibration = 'single') {
    vibrate(theme)

    const duration = THEME_VIBRATION_TO_DURATION[theme] || THEME_VIBRATION_TO_DURATION.single

    this.blink(duration).then(() => {
      if (theme === 'double') {
        setTimeout(() => {
          this.blink(duration)
        }, duration / 2)
      }
    })

    soundTab.play()
  }
}

const orchestrator = new Orchestrator()
export default orchestrator
