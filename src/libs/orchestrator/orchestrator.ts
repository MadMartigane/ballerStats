import { strToU8, unzip, zip } from 'fflate'
import bsEventBus from '../event-bus'
import Match from '../match'
import Matchs from '../matchs'
import {
  clearAllPhotos,
  deletePhoto,
  getAllPhotoEntries,
  hasPhoto,
  PHOTO_FILE_EXTENSION,
  PHOTO_MIME_TYPE,
  storePhoto,
} from '../photo-store/photo-store'
import Player from '../player'
import Players from '../players'
import { soundTab } from '../sounds'
import {
  getStoredMatchs,
  getStoredPlayers,
  getStoredTeams,
  storeMatchs,
  storePlayers,
  storeTeams,
} from '../store'
import Team from '../team'
import Teams from '../teams'
import { persistTitles, titles, DEFAULT_TITLES } from '../trombi-titles-store'
import { confirmAction, mount, toast, unmount } from '../utils'
import { type ThemeVibration, vibrate } from '../vibrator'
import type { GlobalDB } from './orchestrator.d'

const THEME_VIBRATION_TO_DURATION: { [key in ThemeVibration]: number } = {
  single: 100,
  double: 100,
  long: 200,
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

export class Orchestrator {
  #players: Players = new Players()
  #teams = new Teams()
  #matchs = new Matchs()
  #lastPlayersRecrod: number | null = null
  #lastTeamsRecrod: number | null = null
  #lastMatchsRecrod: number | null = null

  constructor() {
    this.getStoredPlayers()
    this.getStoredTeams()
    this.getStoredMatchs()
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
  }
  private updateLastPlayersRecrod() {
    this.#lastPlayersRecrod = Date.now()
  }

  private updateLastTeamsRecrod() {
    this.#lastTeamsRecrod = Date.now()
  }

  private updateLastMatchsRecrod() {
    this.#lastMatchsRecrod = Date.now()
  }

  private storePlayers() {
    this.updateLastPlayersRecrod()

    storePlayers(this.#players.getRawData(), this.#lastPlayersRecrod)
      .then(() => {
        this.throwSynchroSuccessEvent()
      })
      .catch(() => {
        this.throwSynchroFailEvent()
      })
  }

  private storeTeams() {
    this.updateLastTeamsRecrod()

    storeTeams(this.#teams.getRawData(), this.#lastTeamsRecrod)
      .then(() => {
        this.throwSynchroSuccessEvent()
      })
      .catch(() => {
        this.throwSynchroFailEvent()
      })
  }

  private storeMatchs() {
    this.updateLastMatchsRecrod()

    storeMatchs(this.#matchs.getRawData(), this.#lastMatchsRecrod)
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
    if (!this.#lastPlayersRecrod || stored.lastRecord > this.#lastPlayersRecrod) {
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
    if (!this.#lastTeamsRecrod || stored.lastRecord > this.#lastTeamsRecrod) {
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
    if (!this.#lastMatchsRecrod || stored.lastRecord > this.#lastMatchsRecrod) {
      this.#matchs = new Matchs(stored.data)
      this.throwTeamsUpdatedEvent()
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

  private async doClearDB() {
    this.removeAllPlayers()
    this.removeAllTeams()
    this.removeAllMatchs()
    await persistTitles({ ...DEFAULT_TITLES })
    await clearAllPhotos()
  }

  private async doOverwriteDB(json: GlobalDB) {
    for (const playerData of json.players) {
      const newPlayer = new Player(playerData)
      this.Players.add(newPlayer)
    }

    for (const teamData of json.teams) {
      const newTeam = new Team(teamData)
      this.Teams.add(newTeam)
    }

    for (const matchData of json.matchs) {
      const newMatch = new Match(matchData)
      this.Matchs.add(newMatch)
    }

    await persistTitles(json.trombiTitles || { ...DEFAULT_TITLES })
  }

  public get Players() {
    return this.#players
  }

  public get Teams() {
    return this.#teams
  }

  public get Matchs() {
    return this.#matchs
  }

  public throwPlayersUpdatedEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::PLAYERS::CHANGE', mute)
  }

  public throwTeamsUpdatedEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::TEAMS::CHANGE', mute)
  }

  public throwMatchsUpdatedEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::MATCHS::CHANGE', mute)
  }

  public throwSynchroSuccessEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::SYNCHRO::SUCCESS', mute)
  }

  public throwSynchroFailEvent(mute = false) {
    bsEventBus.dispatchEvent('BS::SYNCHRO::FAIL', mute)
  }

  public getPlayer(id?: string | null) {
    if (!id) {
      return null
    }

    return this.#players.players.find((candidate) => candidate.id === id) || null
  }

  public getTeam(id?: string | null) {
    if (!id) {
      return null
    }

    return this.#teams.teams.find((candidate) => candidate.id === id) || null
  }

  public getMatch(id?: string | null) {
    if (!id) {
      return null
    }

    return this.#matchs.matchs.find((candidate) => candidate.id === id) || null
  }

  public bigClean() {
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
      return
    }
  }

  public getJerseySortedPlayers(playerIds?: Array<string>) {
    if (!playerIds) {
      return []
    }

    const players = playerIds.map((playerId) => this.getPlayer(playerId))

    return players.sort((a, b) => Number.parseInt(a?.jerseyNumber || '0') - Number.parseInt(b?.jerseyNumber || '0'))
  }

  public async exportDB() {
    const date = new Date()

    const globalDB: GlobalDB = {
      timestamp: date.getTime(),
      players: this.Players.players.map((player) => player.getRawData()),
      teams: this.Teams.teams.map((team) => team.getRawData()),
      matchs: this.Matchs.matchs.map((match) => match.getRawData()),
      trombiTitles: titles,
    }

    const files: Record<string, Uint8Array> = {
      'data.json': strToU8(JSON.stringify(globalDB)),
    }

    const photoEntries = await getAllPhotoEntries()
    for (const entry of photoEntries) {
      const buffer = await entry.blob.arrayBuffer()
      files[`photos/${entry.playerId}${PHOTO_FILE_EXTENSION}`] = new Uint8Array(buffer)
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

    const blob = new Blob([zipped], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const fileName = `baller-stats-export-db-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}.bstat`
    anchor.setAttribute('href', url)
    anchor.setAttribute('download', fileName)
    anchor.style.visibility = 'hidden'
    mount(anchor)
    anchor.click()
    unmount(anchor)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
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
    const rawData = JSON.parse(decoder.decode(dataJson)) as GlobalDB

    if (!rawData || !rawData.timestamp) {
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
        photos.set(playerData.id, new Blob([photoData], { type: PHOTO_MIME_TYPE }))
        return playerData
      }
      // Photo referenced in metadata but missing from archive — correct the flag
      return { ...playerData, hasPhoto: false }
    })

    return { rawData: { ...rawData, players: correctedPlayers }, photos }
  }

  private async parseImportData(uint8: Uint8Array): Promise<{ rawData: GlobalDB; photos?: Map<string, Blob> }> {
    // Try ZIP format first
    const zipResult = await this.tryParseZip(uint8)
    if (zipResult) {
      return zipResult
    }

    // Legacy JSON fallback
    const text = new TextDecoder().decode(uint8)
    const rawData = JSON.parse(text) as GlobalDB

    if (!rawData || !rawData.timestamp) {
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
    if (!files || !files[0]) {
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

  public async importDB(
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
      `Vous êtes sur le point d\u2019importer ${rawData?.players.length || 0} joueurs, ${rawData?.teams.length || 0} équipes et ${rawData?.matchs.length || 0} matchs.`
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

  public get Photos() {
    return {
      store: async (playerId: string, blob: Blob) => {
        await storePhoto(playerId, blob)
        const player = this.getPlayer(playerId)
        if (player) {
          player.hasPhoto = true
        }
      },
      delete: async (playerId: string) => {
        await deletePhoto(playerId)
        const player = this.getPlayer(playerId)
        if (player) {
          player.hasPhoto = false
        }
      },
      hasPhoto,
      getAll: getAllPhotoEntries,
    }
  }

  public blink(duration: number): Promise<void> {
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

  public throwUserActionFeedback(theme: ThemeVibration = 'single') {
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
