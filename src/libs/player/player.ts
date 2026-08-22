import { getUniqId } from '../utils/utils'
import type { PlayerRawData } from './player.d'

export const LICENSE_NUMBER_MAX_LENGTH = 12

const scoreFields: {
  [key: string]: { score: number; isSet: (player: Player) => boolean }
} = {
  firstName: {
    isSet: (player: Player) => Boolean(player.firstName),
    score: 10,
  },
  jerseyNumber: {
    isSet: (player: Player) => Boolean(player.jerseyNumber),
    score: 10,
  },
  lastName: {
    isSet: (player: Player) => Boolean(player.lastName),
    score: 10,
  },
  nicName: {
    isSet: (player: Player) => Boolean(player.nicName),
    score: 20,
  },
}
const minimalSoreToBeRegisterable = 30

export default class Player {
  #id: string
  firstName?: string
  lastName?: string
  jerseyNumber?: string
  licenseNumber?: string
  birthDay?: Date
  nicName?: string
  hasPhoto = false
  phone?: string
  email?: string

  constructor(data?: PlayerRawData) {
    this.#id = data?.id || getUniqId()

    if (data) {
      this.setFromRawData(data)
    }
  }

  get id() {
    return this.#id
  }

  get isRegisterable() {
    const score = Object.keys(scoreFields).reduce((previousScore: number, field: string) => {
      if (scoreFields[field].isSet(this)) {
        return previousScore + scoreFields[field].score
      }

      return previousScore
    }, 0)

    return score >= minimalSoreToBeRegisterable
  }

  setFromRawData(data: PlayerRawData) {
    this.#id = data.id || this.#id
    this.firstName = data.firstName
    this.lastName = data.lastName
    this.jerseyNumber = data.jerseyNumber || (data as { jersayNumber?: string }).jersayNumber
    this.licenseNumber = data.licenseNumber
    this.nicName = data.nicName

    if (data.birthDay) {
      this.birthDay = new Date(data.birthDay)
    }

    this.hasPhoto = data.hasPhoto ?? false
    this.phone = data.phone
    this.email = data.email
  }

  getRawData(): PlayerRawData {
    const data: PlayerRawData = {
      id: this.#id,
    }

    if (this.firstName) {
      data.firstName = this.firstName
    }

    if (this.lastName) {
      data.lastName = this.lastName
    }

    if (this.jerseyNumber) {
      data.jerseyNumber = this.jerseyNumber
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

    if (this.phone) {
      data.phone = this.phone
    }
    if (this.email) {
      data.email = this.email
    }

    data.hasPhoto = this.hasPhoto

    return data
  }

  update(data: PlayerRawData) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
  }
}

export function hasJerseyNumber(player: Player): player is Player & { jerseyNumber: string } {
  return player.jerseyNumber !== undefined && player.jerseyNumber !== ''
}

export function sortPlayersByJersey(playersList: Player[]): Player[] {
  const withJersey = playersList
    .filter((p) => hasJerseyNumber(p))
    .sort((a, b) => Number.parseInt(a.jerseyNumber, 10) - Number.parseInt(b.jerseyNumber, 10))
  const withoutJersey = playersList.filter((p) => !hasJerseyNumber(p))
  return [...withJersey, ...withoutJersey]
}
