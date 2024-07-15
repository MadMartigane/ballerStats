import Players from '../players'
import bsEventBus from '../event-bus'
import { getStoredPlayers, storePlayers } from '../store'

export class Orchestrator {
  #players: Players = new Players()
  #lastPlayersRecrod: number | null = null

  constructor() {
    this.getStoredPlayers()
    this.installEventHandlers()
  }

  private installEventHandlers() {
    bsEventBus.addEventListener('BS::PLAYERS::CHANGE', () => {
      console.log(
        'orchestrator received BS::PLAYERS::CHANGE event, storing players',
      )
      this.storePlayers()
    })
  }

  private throwPlayersUpdatedEvent() {
    bsEventBus.dispatchEvent('BS::PLAYERS::CHANGE')
  }

  private throwPlayersSynchroSuccessEvent() {
    bsEventBus.dispatchEvent('BS::SYNCHRO::SUCCESS')
  }

  private throwPlayersSynchroFailEvent() {
    bsEventBus.dispatchEvent('BS::SYNCHRO::FAIL')
  }

  private updateLastRecrod() {
    this.#lastPlayersRecrod = Date.now()
  }

  private storePlayers() {
    storePlayers(this.players.getPlayersRawData())
      .then(() => {
        this.throwPlayersSynchroSuccessEvent()
      })
      .catch(() => {
        this.throwPlayersSynchroFailEvent()
      })

    this.updateLastRecrod()
  }

  private async getStoredPlayers() {
    const stored = await getStoredPlayers().catch(() => {
      this.throwPlayersSynchroFailEvent()
    })

    if (!stored) {
      this.throwPlayersSynchroSuccessEvent()
      return
    }

    // TODO: add lastRecord (timestamp) in the player and compare each record
    if (!this.#lastPlayersRecrod || stored.lastRecord > this.#lastPlayersRecrod) {
      this.#players = new Players(stored.players)

    }

    this.throwPlayersUpdatedEvent()
  }

  public get players() {
    return this.#players
  }
}

const orchestrator = new Orchestrator()
export default orchestrator
