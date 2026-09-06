import { strToU8, unzip, zip } from 'fflate'
import type Club from '../club/club'
import type { ClubRawData } from '../club/club.d'
import { createDefaultClubData, migrateClubData } from '../club/club-migration'
import Clubs from '../clubs/clubs'
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
import type { PlayerRawData } from '../player/player.d'
import Players from '../players/players'
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
  storeContacts,
  storeMatchs,
  storePlayers,
  storeTeams,
} from '../store/store'
import Team from '../team/team'
import type { TeamRawData } from '../team/team.d'
import Teams from '../teams/teams'
import type { TrombiTitles } from '../trombi-titles'
import { DEFAULT_TITLES, persistTitles, titles } from '../trombi-titles-store'
import { confirmAction, downloadBlob, toast } from '../utils/utils'
import { vibrate } from '../vibrator/vibrator'
import type { ThemeVibration } from '../vibrator/vibrator.d'
import type { DomainDataset, GlobalDB } from './orchestrator.d'
import type { PhotoChange } from './player-batch'
import {
  applyPhoto,
  replacePlayerContactsSilent,
  validateContactReplacementBatch,
  validateNewPlayerBatch,
} from './player-batch'

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
  #players: Players = new Players()
  #teams = new Teams()
  #matchs = new Matchs()
  #contacts = new Contacts()
  #clubs = new Clubs()
  #lastPlayersRecord: number | null = null
  #lastTeamsRecord: number | null = null
  #lastMatchsRecord: number | null = null
  #lastContactsRecord: number | null = null
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
    this.#players = new Players(migration.players)
    this.#teams = new Teams(migration.teams)

    if (migration.players.length > 0) {
      this.#lastPlayersRecord = Date.now()
      storePlayers(migration.players, this.#lastPlayersRecord)
    }
    if (migration.teams.length > 0) {
      this.#lastTeamsRecord = Date.now()
      storeTeams(migration.teams, this.#lastTeamsRecord)
    }
    this.#lastClubsRecord = Date.now()
    storeClubs(migration.clubs, this.#lastClubsRecord)
    persistTitles(migration.trombiTitles)
  }

  private updateLastPlayersRecord() {
    this.#lastPlayersRecord = Date.now()
  }

  private updateLastTeamsRecord() {
    this.#lastTeamsRecord = Date.now()
  }

  private updateLastMatchsRecord() {
    this.#lastMatchsRecord = Date.now()
  }

  private updateLastContactsRecord() {
    this.#lastContactsRecord = Date.now()
  }

  private updateLastClubsRecord() {
    this.#lastClubsRecord = Date.now()
  }

  private storePlayers() {
    this.updateLastPlayersRecord()

    storePlayers(this.#players.getRawData(), this.#lastPlayersRecord)
      .then(() => {
        this.throwSynchroSuccessEvent()
      })
      .catch(() => {
        this.throwSynchroFailEvent()
      })
  }

  private storeTeams() {
    this.updateLastTeamsRecord()

    storeTeams(this.#teams.getRawData(), this.#lastTeamsRecord)
      .then(() => {
        this.throwSynchroSuccessEvent()
      })
      .catch(() => {
        this.throwSynchroFailEvent()
      })
  }

  private storeMatchs() {
    this.updateLastMatchsRecord()

    storeMatchs(this.#matchs.getRawData(), this.#lastMatchsRecord)
      .then(() => {
        this.throwSynchroSuccessEvent()
      })
      .catch(() => {
        this.throwSynchroFailEvent()
      })
  }

  private storeContacts() {
    this.updateLastContactsRecord()

    storeContacts(this.#contacts.getRawData(), this.#lastContactsRecord)
      .then(() => {
        this.throwSynchroSuccessEvent()
      })
      .catch(() => {
        this.throwSynchroFailEvent()
      })
  }

  private storeClubs() {
    this.updateLastClubsRecord()

    storeClubs(this.#clubs.getRawData(), this.#lastClubsRecord)
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

    // TODO: add lastRecord (timestamp) in the player and compare each records
    if (!this.#lastPlayersRecord || stored.lastRecord > this.#lastPlayersRecord) {
      this.#players = new Players(stored.data)
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

    // TODO: add lastRecord (timestamp) in the team and compare each records
    if (!this.#lastTeamsRecord || stored.lastRecord > this.#lastTeamsRecord) {
      this.#teams = new Teams(stored.data)
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

    // TODO: add lastRecord (timestamp) in the match and compare each records
    if (!this.#lastMatchsRecord || stored.lastRecord > this.#lastMatchsRecord) {
      this.#matchs = new Matchs(stored.data)
      this.throwTeamsUpdatedEvent()
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

    if (!this.#lastContactsRecord || stored.lastRecord > this.#lastContactsRecord) {
      this.#contacts = new Contacts(stored.data)
      this.throwContactsUpdatedEvent()
    }
  }

  private async getStoredClubs() {
    const stored = await getStoredClubs().catch(() => {
      this.throwSynchroFailEvent()
    })

    if (!stored) {
      this.throwSynchroSuccessEvent()
      return
    }

    if (!this.#lastClubsRecord || stored.lastRecord > this.#lastClubsRecord) {
      this.#clubs = new Clubs(stored.data)
      this.throwClubsUpdatedEvent()
    }
  }

  private removeAllPlayers() {
    for (const player of this.Players.players) {
      this.Players.remove(player)
    }
  }

  private removeAllTeams() {
    for (const team of this.Teams.teams) {
      this.Teams.remove(team)
    }
  }

  private removeAllMatchs() {
    for (const match of this.Matchs.matchs) {
      this.Matchs.remove(match)
    }
  }

  private removeAllContacts() {
    for (const contact of this.Contacts.contacts) {
      this.Contacts.remove(contact)
    }
  }

  private clearCollectionsOnly(): void {
    this.removeAllPlayers()
    this.removeAllTeams()
    this.removeAllMatchs()
    this.removeAllContacts()
  }

  private addAll(dataset: DomainDataset): void {
    for (const player of dataset.players ?? []) {
      this.Players.add(player)
    }
    for (const team of dataset.teams ?? []) {
      this.Teams.add(team)
    }
    for (const match of dataset.matchs ?? []) {
      this.Matchs.add(match)
    }
    for (const contact of dataset.contacts ?? []) {
      this.Contacts.add(contact)
    }
  }

  private async doClearDB() {
    this.clearCollectionsOnly()
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
    this.addAll({
      contacts: (json.contacts ?? []).map((c) => new Contact(c)),
      matchs: json.matchs.map((m) => new Match(m)),
      players: migration.players.map((p) => new Player(p)),
      teams: migration.teams.map((t) => new Team(t)),
    })
    await persistTitles(migration.trombiTitles)
    this.throwClubsUpdatedEvent()
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

  get Clubs() {
    return this.#clubs
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

  throwClubsUpdatedEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::CLUBS::CHANGE', mute)
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

  /**
   * Finalize a player batch: best-effort photo write/delete, run AFTER the
   * in-memory batch commit, then fire the change events. Photo I/O is the only
   * fallible step and runs last, so a failure never aborts the batch: data stays
   * committed with its previous `hasPhoto` flag and the user is warned — same
   * policy as the import flow's photo restore.
   *
   * Ordering policy (owned by this helper, shared by both batch methods):
   * synchronous commit first, photo I/O last, events last of all. All validation
   * is pure and synchronous (no I/O), then the player and its contacts are
   * committed back-to-back via silent variants with no `await` between
   * validation and the last mutation, so the in-memory commit cannot fail or
   * interleave (JS single-threading): it is atomic by construction — either both
   * land or neither does. No rollback path is needed. The photo I/O runs LAST
   * and is best-effort, so no abort path in this flow orphans a photo: nothing
   * aborts after it. A failure leaves the data committed with its previous
   * `hasPhoto` flag and warns the user. A single CONTACTS::CHANGE and a single
   * PLAYERS::CHANGE are fired only after everything, contacts FIRST so a
   * mid-persist quota failure degrades to bigClean-cleanable orphan contacts
   * instead of a player silently missing its contacts.
   *
   * The flag propagation is internal: after a successful write/delete, the final
   * `player.hasPhoto` flag is pushed through the non-throwing
   * `Players.setHasPhotoSilent` seam, which reports whether the player was still
   * present. When the player was removed concurrently during the I/O window, the
   * just-written blob is undone via a best-effort photo-store delete (its own
   * failure is swallowed) so the blob is not orphaned. When the I/O failed, the
   * catch skips the flag propagation. Both batch methods call this helper
   * identically.
   */
  private async finalizePlayerBatch(player: Player, change: PhotoChange): Promise<void> {
    try {
      await applyPhoto(player, change)
      const playerStillPresent = this.#players.setHasPhotoSilent(player.id, player.hasPhoto)
      if (change.kind === 'set' && !playerStillPresent) {
        await deletePhoto(player.id).catch(() => {
          // Swallow the cleanup failure: the blob is already orphaned, nothing to do.
        })
      }
    } catch (error) {
      console.error('[Orchestrator] Photo storage failed (batch committed without the photo change):', error)
      if (change.kind === 'set') {
        toast("Le joueur a été enregistré mais sa photo n'a pas pu être sauvegardée.", 'error')
      } else if (change.kind === 'delete') {
        toast("Le joueur a été enregistré mais sa photo n'a pas pu être supprimée.", 'error')
      }
    }

    this.throwContactsUpdatedEvent()
    this.throwPlayersUpdatedEvent()
  }

  /**
   * Register a brand-new player together with its contacts and the requested
   * photo change.
   *
   * Validation is pure and synchronous: the new player must not collide with an
   * existing player or contact, and the draft contacts must be registerable.
   *
   * Shared commit/photo/event policy: see {@link finalizePlayerBatch}.
   */
  async registerNewPlayerWithContacts(player: Player, contacts: Contact[], change: PhotoChange): Promise<void> {
    validateNewPlayerBatch(this.#players.players, this.#contacts.contacts, player, contacts)

    this.#players.addSilent(player)
    for (const contact of contacts) {
      this.#contacts.addSilent(contact)
    }
    await this.finalizePlayerBatch(player, change)
  }

  /**
   * Update an existing player's data, contacts and requested photo change as one
   * atomic batch. This is the canonical edit path: `BsPlayers.registerPlayer`
   * calls only this method for edits.
   *
   * Validation is pure and synchronous and runs before the commit: the player
   * existence check plus the full draft-contacts validation (registerability,
   * belong-to-player, intra-batch duplicates and the global addable check
   * against the other players' contacts).
   *
   * Shared commit/photo/event policy: see {@link finalizePlayerBatch}.
   *
   * @throws {Error} When the player id doesn't exist or the draft is invalid.
   * Photo I/O failures are caught and reported, never rethrown.
   */
  async updatePlayerWithPhotoAndContacts(player: Player, draftContacts: Contact[], change: PhotoChange): Promise<void> {
    const existingPlayer = this.#players.getById(player.id)
    if (!existingPlayer) {
      throw new Error(`[Orchestrator.updatePlayerWithPhotoAndContacts()] The player id ${player.id} doesn't exist.`)
    }

    validateContactReplacementBatch(this.#contacts.contacts, player, draftContacts)

    this.#players.updatePlayerSilent(player)
    replacePlayerContactsSilent(this.#contacts, player.id, draftContacts)
    await this.finalizePlayerBatch(player, change)
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
    if (dataset.clubs !== undefined) {
      this.#clubs = new Clubs(dataset.clubs.map((club: Club) => club.getRawData()))
      this.throwClubsUpdatedEvent()
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
      clubs: this.Clubs.clubs.map((club) => club.getRawData()),
      contacts: this.Contacts.contacts.map((contact) => contact.getRawData()),
      matchs: this.Matchs.matchs.map((match) => match.getRawData()),
      players: this.Players.players.map((player) => player.getRawData()),
      teams: this.Teams.teams.map((team) => team.getRawData()),
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
