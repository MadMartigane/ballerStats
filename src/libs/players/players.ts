import BsPlayer, { BsPlayerRawData } from '../player'

export default class BsPlayers {
  #users: Array<BsPlayer> = []
  #onUpdateCallbacks: Array<() => void> = []

  constructor(userDatas?: Array<BsPlayerRawData>) {
    if (userDatas) {
      this.setUsersFromRawData(userDatas)
    }
  }

  private throwUpdatedUser() {
    this.#onUpdateCallbacks.forEach(callback => {
      setTimeout(() => {
        callback()
      })
    })
  }

  public get users(): Array<BsPlayer> {
    return this.#users.map((user: BsPlayer): BsPlayer => {
      return new BsPlayer(user.getRowData())
    })
  }

  public setUsersFromRawData(data: Array<BsPlayerRawData>) {
    this.#users = data.map(
      (userData: BsPlayerRawData) => new BsPlayer(userData),
    )
  }

  public updateUser(newUser: BsPlayer) {
    const oldUser = this.#users.find(
      currentUser => currentUser.id === newUser.id,
    )
    if (!oldUser) {
      throw new Error(
        `[BsUsers.updateUser()] The user id ${newUser.id} doesn't exist, Please use .add() method instead.`,
      )
    }

    oldUser.setFromRawData(newUser.getRowData())
    this.throwUpdatedUser()
  }

  public onUpdate(callback: () => void) {
    this.#onUpdateCallbacks.push(callback)
  }
}
