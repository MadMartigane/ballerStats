import bsEventBus from '../event-bus'
import Player, { type PlayerRawData } from '../player'

export default class Players {
  #players: Array<Player> = []

  constructor(playerDatas?: Array<PlayerRawData>) {
    if (playerDatas) {
      this.setFromRawData(playerDatas)
    }
  }

  private throwUpdatedPlayerEvent() {
    bsEventBus.dispatchEvent('BS::PLAYERS::CHANGE')
  }

  private getPlayer(newPlayer: Player) {
    return this.#players.find((currentPlayer) => currentPlayer.id === newPlayer.id)
  }

  public get players(): Array<Player> {
    return this.#players.map((player: Player): Player => {
      return new Player(player.getRawData())
    })
  }

  public get length() {
    return this.#players.length
  }

  public setFromRawData(data: Array<PlayerRawData>) {
    if (!data) {
      this.#players = []
      return
    }

    this.#players = data.map((playerData: PlayerRawData) => new Player(playerData))
    this.throwUpdatedPlayerEvent()
  }

  public updatePlayer(newPlayer: Player) {
    const oldPlayer = this.#players.find((currentPlayer) => currentPlayer.id === newPlayer.id)
    if (!oldPlayer) {
      throw new Error(
        `[BsPlayers.updatePlayer()] The player id ${newPlayer.id} doesn't exist, Please use .add() method instead.`,
      )
    }

    oldPlayer.setFromRawData(newPlayer.getRawData())
    this.throwUpdatedPlayerEvent()
  }

  public getRawData() {
    return this.#players.map((player: Player) => player.getRawData())
  }

  public add(newPlayer: Player) {
    if (!newPlayer.isRegisterable) {
      throw new Error(`[BsPlayers.add()] The player id ${newPlayer.id} is not registerable, Please complete the data.`)
    }

    const alreadyRegisteredPlayer = this.getPlayer(newPlayer)
    if (alreadyRegisteredPlayer) {
      throw new Error(
        `[BsPlayers.add()] The player id ${newPlayer.id} already exist, Please use .updatePlayer() method instead.`,
      )
    }

    this.#players.push(newPlayer)
    this.throwUpdatedPlayerEvent()
  }

  public remove(player: Player) {
    const idx = this.#players.findIndex((candidate: Player) => candidate.id === player.id)

    if (idx === -1) {
      throw new Error(`[BsPlayers.remove()] The player id ${player.id} not found, Unable to remove it.`)
    }

    this.#players.splice(idx, 1)
    this.throwUpdatedPlayerEvent()
  }
}
