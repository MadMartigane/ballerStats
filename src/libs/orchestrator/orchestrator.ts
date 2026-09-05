import { strToU8, unzip, zip } from 'fflate'
import { batch } from 'solid-js'
import type Club from '../club/club'
import type { ClubRawData } from '../club/club.d'
import { createDefaultClubData, migrateClubData } from '../club/club-migration'
import Clubs from '../clubs/clubs'
import type { ContactRawData } from '../contact/contact.d'
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
import type { PlayerRawData } from '../player/player.d'
import { soundTab } from '../sounds/tab'
import {
  getStoredClubs,
  getStoredContacts,
  getStoredDataSync,
  getStoredMatchs,
  getStoredPlayers,
  getStoredTeams,
  STORAGE_CLUBS_KEY,
  STORAGE_PLAYERS_KEY,
  STORAGE_TEAMS_KEY,
  STORAGE_TROMBI_TITLES_KEY,
  storeClubs,
  storeMatchs,
  storePlayers,
  storeTeams,
} from '../store/store'
import { getRawContacts, hydrateContacts, replaceAllContacts, replacePlayerContacts } from '../stores/contacts-store'
import {
  addPlayer,
  getPlayerById,
  getRawPlayers,
  hydratePlayers,
  replaceAllPlayers,
  updatePlayer,
} from '../stores/players-store'
import { addTeam, getRawTeams, getTeamById, hydrateTeams, replaceAllTeams } from '../stores/teams-store'
import Team from '../team/team'
import type { TeamRawData } from '../team/team.d'
import type { TrombiTitles } from '../trombi-titles'
import { DEFAULT_TITLES, persistTitles, titles } from '../trombi-titles-store'
import { confirmAction, downloadBlob, toast } from '../utils/utils'
import { vibrate } from '../vibrator/vibrator'
import type { ThemeVibration } from '../vibrator/vibrator.d'
import type { DomainDataset, GlobalDB } from './orchestrator.d'
import { applyPhoto, validateContactReplacementBatch, validateNewPlayerBatch } from './player-batch'

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
    (candidate.contacts === undefined || candidate.contacts === null || Array.isArray(candidate.contacts)) &&
    (candidate.clubs === undefined || candidate.clubs === null || Array.isArray(candidate.clubs))
  )
}

export class Orchestrator {
  #matchs = new Matchs()
  #clubs = new Clubs()
  #lastPlayersRecord: number | null = null
  #lastTeamsRecord: number | null = null
  #lastMatchsRecord: number | null = null
  #lastClubsRecord: number | null = null

  constructor() {
    this.runStartupMigration()
    this.getStoredPlayers()
    this.getStoredTeams()
    this.getStoredMatchs()
    this.getStoredContacts()
    this.getStoredClubs()
    this.installEventHandlers()
  }

  private installEventHandlers() {
    bsEventBus.addEventListener('BS::MATCHS::CHANGE', () => {
      this.storeMatchs()
    })

    bsEventBus.addEventListener('BS::CLUBS::CHANGE', () => {
      this.storeClubs()
    })
  }

  /**
   * One-time bridge to the Club entity (startup + older .bstat imports). Runs
   * synchronously so migrated data is persisted before the async loaders resolve
   * (localStorage writes are synchronous), guaranteeing a club for the UI.
   */
  private runStartupMigration(): void {
    const storedClubs = getStoredDataSync<ClubRawData[]>(STORAGE_CLUBS_KEY)
    const storedTitles = getStoredDataSync<TrombiTitles>(STORAGE_TROMBI_TITLES_KEY)
    const storedPlayers = getStoredDataSync<PlayerRawData[]>(STORAGE_PLAYERS_KEY)
    const storedTeams = getStoredDataSync<TeamRawData[]>(STORAGE_TEAMS_KEY)

    const migration = migrateClubData({
      clubs: storedClubs?.data,
      players: storedPlayers?.data,
      teams: storedTeams?.data,
      trombiTitles: storedTitles?.data,
    })

    if (!migration.changed) {
      return
    }

    this.#clubs = new Clubs(migration.clubs)
    hydratePlayers(migration.players)
    hydrateTeams(migration.teams)

    if (migration.players.length > 0) {
      this.#lastPlayersRecord = Date.now()
      storePlayers(migration.players, this.#lastPlayersRecord)
    }
    if (migration.teams.length > 0) {
      this.#lastTeamsRecord = Date.now()
      storeTeams(migration.teams, this.#lastTeamsRecord).catch((error: unknown) => {
        console.error('storeTeams failed:', error)
      })
    }
    this.#lastClubsRecord = Date.now()
    storeClubs(migration.clubs, this.#lastClubsRecord).catch((error: unknown) => {
      console.error('storeClubs failed:', error)
    })
    persistTitles(migration.trombiTitles)
  }

  private updateLastMatchsRecord() {
    this.#lastMatchsRecord = Date.now()
  }

  private updateLastClubsRecord() {
    this.#lastClubsRecord = Date.now()
  }

  private storeMatchs() {
    this.updateLastMatchsRecord()

    storeMatchs(this.#matchs.getRawData(), this.#lastMatchsRecord).catch((error: unknown) => {
      console.error('storeMatchs failed:', error)
    })
  }

  private storeClubs() {
    this.updateLastClubsRecord()

    storeClubs(this.#clubs.getRawData(), this.#lastClubsRecord).catch((error: unknown) => {
      console.error('storeClubs failed:', error)
    })
  }

  private async getStoredPlayers() {
    const stored = await getStoredPlayers().catch((error: unknown) => {
      console.error('getStoredPlayers failed:', error)
    })

    if (!stored) {
      return
    }

    // TODO: add lastRecord (timestamp) in the player and compare each records
    if (!this.#lastPlayersRecord || stored.lastRecord > this.#lastPlayersRecord) {
      hydratePlayers(stored.data)
    }
  }

  private async getStoredTeams() {
    const stored = await getStoredTeams().catch((error: unknown) => {
      console.error('getStoredTeams failed:', error)
    })

    if (!stored) {
      return
    }

    // TODO: add lastRecord (timestamp) in the team and compare each records
    if (!this.#lastTeamsRecord || stored.lastRecord > this.#lastTeamsRecord) {
      hydrateTeams(stored.data)
    }
  }

  private async getStoredMatchs() {
    const stored = await getStoredMatchs().catch((error: unknown) => {
      console.error('getStoredMatchs failed:', error)
    })

    if (!stored) {
      return
    }

    // TODO: add lastRecord (timestamp) in the match and compare each records
    if (!this.#lastMatchsRecord || stored.lastRecord > this.#lastMatchsRecord) {
      this.#matchs = new Matchs(stored.data)
      this.throwMatchsUpdatedEvent()
    }
  }

  private async getStoredContacts() {
    const stored = await getStoredContacts().catch((error: unknown) => {
      console.error('getStoredContacts failed:', error)
    })

    if (!stored) {
      return
    }

    hydrateContacts(stored.data)
  }

  private async getStoredClubs() {
    const stored = await getStoredClubs().catch((error: unknown) => {
      console.error('getStoredClubs failed:', error)
    })

    if (!stored) {
      return
    }

    if (!this.#lastClubsRecord || stored.lastRecord > this.#lastClubsRecord) {
      this.#clubs = new Clubs(stored.data)
      this.throwClubsUpdatedEvent()
    }
  }

  private removeAllMatchs() {
    for (const match of this.Matchs.matchs) {
      this.Matchs.remove(match)
    }
  }

  private clearCollectionsOnly(): void {
    this.removeAllMatchs()
  }

  private addAll(dataset: DomainDataset): void {
    for (const team of dataset.teams ?? []) {
      addTeam(team.getRawData())
    }
    for (const match of dataset.matchs ?? []) {
      this.Matchs.add(match)
    }
  }

  private async doClearDB() {
    this.clearCollectionsOnly()
    batch(() => {
      replaceAllPlayers([])
      replaceAllContacts([])
      replaceAllTeams([])
    })
    await persistTitles({ ...DEFAULT_TITLES })
    await clearAllPhotos()
    this.#clubs = new Clubs([createDefaultClubData()])
    this.throwClubsUpdatedEvent()
  }

  private async doOverwriteDB(json: GlobalDB) {
    const migration = migrateClubData({
      clubs: json.clubs,
      players: json.players,
      teams: json.teams,
      trombiTitles: json.trombiTitles,
    })
    this.#clubs = new Clubs(migration.clubs)
    batch(() => {
      replaceAllPlayers(migration.players)
      replaceAllContacts(json.contacts ?? [])
    })
    this.addAll({
      matchs: json.matchs.map((m) => new Match(m)),
      teams: json.teams.map((t) => new Team(t)),
    })
    await persistTitles(migration.trombiTitles)
    this.throwClubsUpdatedEvent()
  }

  get Matchs() {
    return this.#matchs
  }

  get Clubs() {
    return this.#clubs
  }

  throwMatchsUpdatedEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::MATCHS::CHANGE', mute)
  }

  throwClubsUpdatedEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::CLUBS::CHANGE', mute)
  }

  getPlayer(id?: string | null) {
    if (!id) {
      return null
    }

    const raw = getPlayerById(id)
    return raw ? new Player(raw) : null
  }

  /**
   * Register a brand-new player together with its contacts and optional photo.
   *
   * Ordering rationale (photo first, in-memory commit last):
   * - All validation is pure and synchronous (no I/O) and runs before any await,
   *   so the in-memory commit below cannot fail once reached: the player and its
   *   contacts are committed back-to-back inside a single Solid `batch` (no
   *   await between them), so the commit is atomic — either both land or neither
   *   does. Each collection is persisted exactly once, and the reactive stores
   *   only expose the full batch.
   * - The photo I/O is the only fallible step, so it runs FIRST. If it fails,
   *   nothing has been committed in-memory yet and the error is rethrown with
   *   nothing to undo — no rollback path is needed. If it succeeds, the
   *   in-memory commit (which cannot fail after validation) follows immediately.
   * - The committed raws are the snapshot validated above, so the draft cannot
   *   drift between validation and commit; only `hasPhoto` is derived from the
   *   photo I/O outcome.
   */
  async registerNewPlayerWithContacts(player: Player, contacts: ContactRawData[], photo?: Blob): Promise<void> {
    const playerRaw = player.getRawData()
    const contactRaws = contacts.map((contact) => ({ ...contact }))

    validateNewPlayerBatch(getRawPlayers(), getRawContacts(), playerRaw, contactRaws)

    await applyPhoto(player, photo)

    const finalHasPhoto = photo ? true : (playerRaw.hasPhoto ?? false)
    batch(() => {
      addPlayer({ ...playerRaw, hasPhoto: finalHasPhoto })
      replacePlayerContacts(player.id, contactRaws)
    })
  }

  /**
   * Update an existing player's data, contacts and optional photo as one atomic
   * batch. This is the canonical edit path: `BsPlayers.registerPlayer` calls
   * only this method for edits.
   *
   * Ordering rationale (photo first, in-memory commit last):
   * - All validation is pure and synchronous (no I/O) and runs before any await:
   *   the player existence check plus the full draft-contacts validation
   *   (registerability, belong-to-player, intra-batch duplicates and the global
   *   addable check against the other players' contacts).
   * - The photo I/O is the only fallible step, so it runs FIRST. If it fails,
   *   nothing has been committed in-memory yet and the error is rethrown with
   *   nothing to undo.
   * - The player and its contacts are then committed back-to-back inside a
   *   single Solid `batch` (no await between them), so the commit is atomic —
   *   either both land or neither does. Each collection is persisted exactly
   *   once and the reactive stores only expose the full batch. The committed
   *   raws are the snapshot validated above.
   *
   * @throws {Error} When the player id doesn't exist or the draft is invalid.
   * Photo I/O failures are rethrown with nothing to undo.
   */
  async updatePlayerWithPhotoAndContacts(
    player: Player,
    draftContacts: ContactRawData[],
    photo?: Blob,
    deletePhotoFlag = false
  ): Promise<void> {
    const playerRaw = player.getRawData()
    const contactRaws = draftContacts.map((contact) => ({ ...contact }))

    if (!getPlayerById(player.id)) {
      throw new Error(`[Orchestrator.updatePlayerWithPhotoAndContacts()] The player id ${player.id} doesn't exist.`)
    }

    validateContactReplacementBatch(getRawContacts(), playerRaw, contactRaws)

    await applyPhoto(player, photo, deletePhotoFlag)

    let finalHasPhoto = playerRaw.hasPhoto ?? false
    if (photo) {
      finalHasPhoto = true
    } else if (deletePhotoFlag) {
      finalHasPhoto = false
    }
    batch(() => {
      updatePlayer(player.id, { ...playerRaw, hasPhoto: finalHasPhoto })
      replacePlayerContacts(player.id, contactRaws)
    })
  }

  getTeam(id?: string | null) {
    if (!id) {
      return null
    }

    const raw = getTeamById(id)
    return raw ? new Team(raw) : null
  }

  getMatch(id?: string | null) {
    if (!id) {
      return null
    }

    return this.#matchs.matchs.find((candidate) => candidate.id === id) || null
  }

  /** Atomically replace all domain data with the given dataset. */
  replaceDataset(dataset: DomainDataset): void {
    batch(() => {
      replaceAllPlayers((dataset.players ?? []).map((player) => player.getRawData()))
      replaceAllContacts((dataset.contacts ?? []).map((contact) => contact.getRawData()))
      replaceAllTeams((dataset.teams ?? []).map((team) => team.getRawData()))
      this.clearCollectionsOnly()
      this.addAll(dataset)
    })
    if (dataset.clubs !== undefined) {
      this.#clubs = new Clubs(dataset.clubs.map((club: Club) => club.getRawData()))
      this.throwClubsUpdatedEvent()
    }
  }

  get hasAnyData(): boolean {
    return (
      getRawPlayers().length > 0 ||
      getRawTeams().length > 0 ||
      this.#matchs.matchs.length > 0 ||
      getRawContacts().length > 0
    )
  }

  bigClean() {
    let cleaned = false
    const cleanedTeams = getRawTeams().map((team) => {
      const cleanPlayerIds = (team.playerIds ?? []).filter((playerId) => Boolean(this.getPlayer(playerId)))

      if ((team.playerIds?.length ?? 0) > cleanPlayerIds.length) {
        cleaned = true
        return { ...team, playerIds: cleanPlayerIds }
      }
      return team
    })

    if (cleaned) {
      replaceAllTeams(cleanedTeams)
    }

    const currentContacts = getRawContacts()
    const keptContacts = currentContacts.filter((contact) => Boolean(this.getPlayer(contact.playerId)))
    if (keptContacts.length < currentContacts.length) {
      replaceAllContacts(keptContacts)
    }
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
      clubs: this.Clubs.clubs.map((club) => club.getRawData()),
      contacts: getRawContacts(),
      matchs: this.Matchs.matchs.map((match) => match.getRawData()),
      players: getRawPlayers(),
      teams: getRawTeams(),
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
        }
      },
      getAll: getAllPhotoEntries,
      hasPhoto,
      store: async (playerId: string, blob: Blob) => {
        await storePhoto(playerId, blob)
        const player = this.getPlayer(playerId)
        if (player) {
          player.hasPhoto = true
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
