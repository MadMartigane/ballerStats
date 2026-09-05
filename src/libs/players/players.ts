import bsEventBus from '../event-bus/event-bus'
import Player from '../player/player'
import type { PlayerRawData } from '../player/player.d'

export function assertPlayerAddable(players: Player[], newPlayer: Player) {
  if (!newPlayer.isRegisterable) {
    throw new Error('[Players.add()] Player is not registerable (missing required data).')
  }
  const alreadyRegistered = players.some((current) => current.id === newPlayer.id)
  if (alreadyRegistered) {
    throw new Error(`[Players.add()] The player id ${newPlayer.id} already exists.`)
  }
}

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

  get players(): Player[] {
    return this.#players.map((player: Player): Player => new Player(player.getRawData()))
  }

  get length() {
    return this.#players.length
  }

  /**
   * Returns a defensive clone of the player with the given id. Mutating the
   * returned instance does not affect the collection — use `updatePlayer`.
   */
  getById(id: string): Player | undefined {
    const player = this.#players.find((candidate) => candidate.id === id)
    return player ? new Player(player.getRawData()) : undefined
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

  updatePlayerSilent(newPlayer: Player) {
    const oldPlayer = this.#players.find((currentPlayer) => currentPlayer.id === newPlayer.id)
    if (!oldPlayer) {
      throw new Error(
        `[BsPlayers.updatePlayer()] The player id ${newPlayer.id} doesn't exist, Please use .add() method instead.`
      )
    }

    oldPlayer.setFromRawData(newPlayer.getRawData())
  }

  updatePlayer(newPlayer: Player) {
    this.updatePlayerSilent(newPlayer)
    this.throwUpdatedPlayerEvent()
  }

  getRawData() {
    return this.#players.map((player: Player) => player.getRawData())
  }

  add(newPlayer: Player) {
    this.addSilent(newPlayer)
    this.throwUpdatedPlayerEvent()
  }

  addSilent(newPlayer: Player) {
    assertPlayerAddable(this.#players, newPlayer)
    this.#players.push(newPlayer)
  }

  remove(player: Player) {
    this.removeSilent(player)
    this.throwUpdatedPlayerEvent()
  }

  removeSilent(player: Player) {
    const idx = this.#players.findIndex((candidate: Player) => candidate.id === player.id)

    if (idx === -1) {
      throw new Error(`[BsPlayers.remove()] The player id ${player.id} not found, Unable to remove it.`)
    }

    this.#players.splice(idx, 1)
  }
}
