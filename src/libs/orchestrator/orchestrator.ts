import Players from '../players'
import bsEventBus from '../event-bus'
import {
  getStoredPlayers,
  getStoredTeams,
  getStoredMatchs,
  storePlayers,
  storeTeams,
  storeMatchs,
} from '../store'
import Teams from '../teams'
import Matchs from '../matchs'
import Team from '../team'

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

  public get Players() {
    return this.#players
  }

  public get Teams() {
    return this.#teams
  }

  public get Matchs() {
    return this.#matchs
  }

  public throwPlayersUpdatedEvent(mute: boolean = false) {
    bsEventBus.dispatchEvent('BS::PLAYERS::CHANGE', mute)
  }

  public throwTeamsUpdatedEvent(mute: boolean = false) {
    bsEventBus.dispatchEvent('BS::TEAMS::CHANGE', mute)
  }

  public throwMatchsUpdatedEvent(mute: boolean = false) {
    bsEventBus.dispatchEvent('BS::MATCHS::CHANGE', mute)
  }

  public throwSynchroSuccessEvent(mute: boolean = false) {
    bsEventBus.dispatchEvent('BS::SYNCHRO::SUCCESS', mute)
  }

  public throwSynchroFailEvent(mute: boolean = false) {
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
    this.Teams.teams.forEach(team => {
      const cleanPlayerIds = team.playerIds.filter(playerId => {
        return Boolean(this.getPlayer(playerId))
      })

      if (team.playerIds.length > cleanPlayerIds.length) {
        team.update({ playerIds: cleanPlayerIds })
        this.Teams.updateTeam(team)
        cleaned = true
      }
    })

    if (cleaned) {
      this.throwTeamsUpdatedEvent()
      return
    }
  }
}

const orchestrator = new Orchestrator()
export default orchestrator
