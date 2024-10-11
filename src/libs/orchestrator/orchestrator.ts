import bsEventBus from '../event-bus'
import Match from '../match'
import Matchs from '../matchs'
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
import { confirmAction, mount, toast, unmount } from '../utils'
import { type ThemeVibration, vibrate } from '../vibrator'
import type { GlobalDB } from './orchestrator.d'

const THEME_VIBRATION_TO_DURATION: { [key in ThemeVibration]: number } = {
  single: 100,
  double: 100,
  long: 200,
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
    if (
      !this.#lastPlayersRecrod ||
      stored.lastRecord > this.#lastPlayersRecrod
    ) {
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

  private doClearDB() {
    this.removeAllPlayers()
    this.removeAllTeams()
    this.removeAllMatchs()
  }

  private doOverwriteDB(json: GlobalDB) {
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
  }

  private async onImportDBLoad(event: ProgressEvent<FileReader>) {
    const target = event.target || event.currentTarget
    // @ts-ignore
    const result = target?.result as string
    if (!result) {
      toast('Impossible de lire les données.', 'error')
      return
    }

    let rawData: GlobalDB
    try {
      rawData = JSON.parse(result) as GlobalDB
    } catch (e) {
      toast('Données non valides.', 'error')
      console.error(e)
      return
    }

    if (!rawData || !rawData.timestamp) {
      toast('Le fichier n’est pas une sauvegarde baller-stats.', 'error')
      return
    }

    const proced = await confirmAction(
      'Import DB',
      `Vous êtes sur le point d’importer ${rawData?.players.length || 0} joueurs, ${rawData?.teams.length || 0} équipes et ${rawData?.matchs.length || 0} matchs.`,
    )
    if (!proced) {
      return
    }

    const cleanUpBefore = await confirmAction(
      'Import DB',
      'Voulez-vous écraser toutes les données ?',
    )
    if (cleanUpBefore) {
      this.doClearDB()
    }

    try {
      this.doOverwriteDB(rawData)
      toast('Import des nouvelles données réussi !', 'success')
    } catch (e) {
      toast('Impossible d’importer les données.', 'error')
      console.error(e)
    }
  }

  private async onImportDBError(event: ProgressEvent<FileReader>) {
    toast('Impossible d’importer les données.', 'error')
    console.error('onImportDBError(): ', event)
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

    return this.#players.players.find(candidate => candidate.id === id) || null
  }

  public getTeam(id?: string | null) {
    if (!id) {
      return null
    }

    return this.#teams.teams.find(candidate => candidate.id === id) || null
  }

  public getMatch(id?: string | null) {
    if (!id) {
      return null
    }

    return this.#matchs.matchs.find(candidate => candidate.id === id) || null
  }

  public bigClean() {
    let cleaned = false
    for (const team of this.Teams.teams) {
      const cleanPlayerIds = team.playerIds.filter(playerId => {
        return Boolean(this.getPlayer(playerId))
      })

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

    const players = playerIds.map(playerId => this.getPlayer(playerId))

    return players.sort(
      (a, b) =>
        Number.parseInt(a?.jersayNumber || '0') -
        Number.parseInt(b?.jersayNumber || '0'),
    )
  }

  public exportDB() {
    const date = new Date()

    const globalDB: GlobalDB = {
      timestamp: date.getTime(),
      players: this.Players.players.map(player => player.getRawData()),
      teams: this.Teams.teams.map(team => team.getRawData()),
      matchs: this.Matchs.matchs.map(match => match.getRawData()),
    }

    const jsonDB = JSON.stringify(globalDB)
    const anchor = document.createElement('a')
    const fileName = `baller-stats-export-db-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}.json`
    const blob = new Blob([jsonDB], {
      type: 'application/json;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    anchor.setAttribute('href', url)
    anchor.setAttribute('download', fileName)
    anchor.style.visibility = 'hidden'
    mount(anchor)
    anchor.click()
    unmount(anchor)
  }

  public async importDB(
    event: Event & {
      currentTarget: HTMLInputElement
      target: HTMLInputElement
    },
  ) {
    const input = event.target || event.currentTarget
    const files = input?.files
    if (!files) {
      toast('Impossible de lire les données.', 'error')
      return
    }

    const file = files[0]

    if (!file) {
      toast('Impossible de lire les données.', 'error')
      return
    }

    const reader = new FileReader()

    reader.onload = event => {
      this.onImportDBLoad(event)
    }
    reader.onerror = event => {
      this.onImportDBError(event)
    }

    reader.readAsText(file, 'UTF-8')
  }

  public blink(duration: number): Promise<void> {
    const main = document.querySelector('main')
    return new Promise(resolve => {
      if (!main) {
        console.warn(
          '[Orchestrator.blink()] Unable to find the <main /> in the DOM.',
        )
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

    const duration =
      THEME_VIBRATION_TO_DURATION[theme] || THEME_VIBRATION_TO_DURATION.single

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
