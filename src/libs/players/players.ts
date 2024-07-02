import BsPlayer, { BsPlayerRawData } from '../player'

export default class BsPlayers {
  #players: Array<BsPlayer> = []
  #onUpdateCallbacks: Array<() => void> = []

  constructor(playerDatas?: Array<BsPlayerRawData>) {
    if (playerDatas) {
      this.setPlayersFromRawData(playerDatas)
    }
  }

  private throwUpdatedPlayer() {
    this.#onUpdateCallbacks.forEach(callback => {
      setTimeout(() => {
        callback()
      })
    })
  }

  public get players(): Array<BsPlayer> {
    return this.#players.map((player: BsPlayer): BsPlayer => {
      return new BsPlayer(player.getRowData())
    })
  }

  public setPlayersFromRawData(data: Array<BsPlayerRawData>) {
    this.#players = data.map(
      (playerData: BsPlayerRawData) => new BsPlayer(playerData),
    )
  }

  public updatePlayer(newPlayer: BsPlayer) {
    const oldPlayer = this.#players.find(
      currentPlayer => currentPlayer.id === newPlayer.id,
    )
    if (!oldPlayer) {
      throw new Error(
        `[BsPlayers.updatePlayer()] The player id ${newPlayer.id} doesn't exist, Please use .add() method instead.`,
      )
    }

    oldPlayer.setFromRawData(newPlayer.getRowData())
    this.throwUpdatedPlayer()
  }

  public onUpdate(callback: () => void) {
    this.#onUpdateCallbacks.push(callback)
  }
}
