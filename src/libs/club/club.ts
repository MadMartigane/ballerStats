import { getUniqId } from '../utils/utils'
import type { ClubRawData } from './club.d'

export const CLUB_LICENSE_MAX_LENGTH = 12

export default class Club {
  #id: string
  name?: string
  licenseNumber?: string

  constructor(data?: ClubRawData) {
    this.#id = data?.id || getUniqId()

    if (data) {
      this.setFromRawData(data)
    }
  }

  get id() {
    return this.#id
  }

  get isRegisterable() {
    return Boolean(this.name)
  }

  setFromRawData(data: ClubRawData) {
    this.#id = data.id || this.#id
    this.name = data.name || ''
    this.licenseNumber = data.licenseNumber || ''
  }

  getRawData(): ClubRawData {
    const data: ClubRawData = {
      id: this.#id,
    }

    if (this.name) {
      data.name = this.name
    }

    if (this.licenseNumber) {
      data.licenseNumber = this.licenseNumber
    }

    return data
  }

  update(data: ClubRawData) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
  }
}
