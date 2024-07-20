import Players from '../players'
import bsEventBus from '../event-bus'
import {
  getStoredPlayers,
  getStoredTeams,
  storePlayers,
  storeTeams,
} from '../store'
import Teams from '../teams'

export class Orchestrator {
  #players: Players = new Players()
  #teams = new Teams()
  #lastPlayersRecrod: number | null = null
  #lastTeamsRecrod: number | null = null

  constructor() {
    this.getStoredPlayers()
    this.getStoredTeams()
    this.installEventHandlers()
  }

  private installEventHandlers() {
    bsEventBus.addEventListener('BS::PLAYERS::CHANGE', () => {
      this.storePlayers()
    })

    bsEventBus.addEventListener('BS::TEAMS::CHANGE', () => {
      this.storeTeams()
    })
  }
  private updateLastPlayersRecrod() {
    this.#lastPlayersRecrod = Date.now()
  }

  private updateLastTeamsRecrod() {
    this.#lastTeamsRecrod = Date.now()
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

    this.throwPlayersUpdatedEvent()
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

  public get Players() {
    return this.#players
  }

  public get Teams() {
    return this.#teams
  }

  public throwPlayersUpdatedEvent(mute: boolean = false) {
    bsEventBus.dispatchEvent('BS::PLAYERS::CHANGE', mute)
  }

  public throwTeamsUpdatedEvent(mute: boolean = false) {
    bsEventBus.dispatchEvent('BS::TEAMS::CHANGE', mute)
  }

  public throwSynchroSuccessEvent(mute: boolean = false) {
    bsEventBus.dispatchEvent('BS::SYNCHRO::SUCCESS', mute)
  }

  public throwSynchroFailEvent(mute: boolean = false) {
    bsEventBus.dispatchEvent('BS::SYNCHRO::FAIL', mute)
  }

  public getPlayer(id: number) {
    return this.#players.players.find(candidate => candidate.id === id)
  }

  public getTeam(id: number) {
    return this.#teams.teams.find(candidate => candidate.id === id)
  }
}

const orchestrator = new Orchestrator()
export default orchestrator
