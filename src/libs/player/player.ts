import { getUniqId } from '../utils'
import { PlayerRawData } from './player.d'

const scoreFields: {
  [key: string]: { score: number; isSet: (player: Player) => boolean }
} = {
  firstName: {
    score: 10,
    isSet: (player: Player) => {
      return Boolean(player.firstName)
    },
  },
  lastName: {
    score: 10,
    isSet: (player: Player) => {
      return Boolean(player.lastName)
    },
  },
  nicName: {
    score: 20,
    isSet: (player: Player) => {
      return Boolean(player.nicName)
    },
  },
  jersayNumber: {
    score: 10,
    isSet: (player: Player) => {
      return Boolean(player.jersayNumber)
    },
  },
}
const minimalSoreToBeRegisterable = 30

export default class Player {
  #id: number
  public firstName?: string
  public lastName?: string
  public jersayNumber?: string
  public licenseNumber?: string
  public birthDay?: Date
  public nicName?: string

  constructor(data?: PlayerRawData) {
    this.#id = data?.id || getUniqId()

    if (data) {
      this.setFromRawData(data)
    }
  }

  public get id(): number {
    return this.#id
  }

  public get isRegisterable() {
    let score = Object.keys(scoreFields).reduce(
      (previousScore: number, field: string) => {
        if (scoreFields[field].isSet(this)) {
          return previousScore + scoreFields[field].score
        }

        return previousScore
      },
      0,
    )

    return score >= minimalSoreToBeRegisterable
  }

  public setFromRawData(data: PlayerRawData) {
    this.#id = data.id || this.#id
    this.firstName = data.firstName
    this.lastName = data.lastName
    this.jersayNumber = data.jersayNumber
    this.licenseNumber = data.licenseNumber
    this.nicName = data.nicName

    if (data.birthDay) {
      this.birthDay = new Date(data.birthDay)
    }
  }

  public getRawData(): PlayerRawData {
    const data: PlayerRawData = {
      id: this.#id,
    }

    if (this.firstName) {
      data.firstName = this.firstName
    }

    if (this.lastName) {
      data.lastName = this.lastName
    }

    if (this.jersayNumber) {
      data.jersayNumber = this.jersayNumber
    }

    if (this.licenseNumber) {
      data.licenseNumber = this.licenseNumber
    }

    if (this.nicName) {
      data.nicName = this.nicName
    }

    if (this.birthDay) {
      data.birthDay = this.birthDay.getTime()
    }

    return data
  }

  public update(data: PlayerRawData) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
  }
}
