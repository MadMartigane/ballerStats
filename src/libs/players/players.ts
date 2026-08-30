import bsEventBus from '../event-bus/event-bus'
import Player from '../player/player'
import type { PlayerRawData } from '../player/player.d'

export default class Players {
  #players: Player[] = []

  constructor(playerDatas?: PlayerRawData[]) {
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

  get players(): Player[] {
    return this.#players
      .filter((player: Player): boolean => player.deletedAt === null)
      .map((player: Player) => new Player(player.getRawData()))
  }

  get length() {
    return this.#players.filter((player: Player): boolean => player.deletedAt === null).length
  }

  setFromRawData(data: PlayerRawData[]) {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: legacy callers/tests pass null to empty the collection, which the array parameter type does not reflect.
    if (!data) {
      this.#players = []
      return
    }

    this.#players = data.map((playerData: PlayerRawData) => new Player(playerData))
    this.throwUpdatedPlayerEvent()
  }

  updatePlayer(newPlayer: Player) {
    const oldPlayer = this.getPlayer(newPlayer)
    if (!oldPlayer) {
      throw new Error(
        `[BsPlayers.updatePlayer()] The player id ${newPlayer.id} doesn't exist, Please use .add() method instead.`
      )
    }

    oldPlayer.update(newPlayer.getRawData())
    this.throwUpdatedPlayerEvent()
  }

  getRawData() {
    return this.#players.map((player: Player) => player.getRawData())
  }

  add(newPlayer: Player) {
    if (!newPlayer.isRegisterable) {
      throw new Error(`[BsPlayers.add()] The player id ${newPlayer.id} is not registerable, Please complete the data.`)
    }

    const alreadyRegisteredPlayer = this.getPlayer(newPlayer)
    if (alreadyRegisteredPlayer) {
      throw new Error(
        `[BsPlayers.add()] The player id ${newPlayer.id} already exist, Please use .updatePlayer() method instead.`
      )
    }

    this.#players.push(newPlayer)
    this.throwUpdatedPlayerEvent()
  }

  remove(player: Player) {
    const target = this.getPlayer(player)
    if (!target) {
      throw new Error(`[BsPlayers.remove()] The player id ${player.id} not found, Unable to remove it.`)
    }
    target.markAsDeleted()
    this.throwUpdatedPlayerEvent()
  }

  /** Hard-wipe (no tombstone) — used by overwrite import. */
  clear() {
    this.#players = []
    this.throwUpdatedPlayerEvent()
  }
}
