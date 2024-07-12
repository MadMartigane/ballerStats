import { getUniqId } from '../utils'
import { BsPlayerRawData } from './player.d'

export default class BsPlayer {
  #id: number
  public firstName: string | null = null
  public lastName: string | null = null
  public jersayNumber: string | null = null
  public licenseNumber: string | null = null

  public birthDay?: Date
  public nicName?: string

  constructor(data?: BsPlayerRawData) {
    this.#id = data?.id || getUniqId()

    if (data) {
      this.setFromRawData(data)
    }
  }

  public get id(): number {
    return this.#id
  }

  public setFromRawData(data: BsPlayerRawData) {
    this.#id = data.id || getUniqId()
    this.firstName = data?.firstName
    this.lastName = data?.lastName
  }

  public getRowData(): BsPlayerRawData {
    const data: BsPlayerRawData = {
      id: this.#id,
      firstName: this.firstName,
      lastName: this.lastName,
      jersayNumber: this.jersayNumber,
      licenseNumber: this.licenseNumber,
    }

    if (this.nicName) {
      data.nicName = this.nicName
    }

    if (this.birthDay) {
      data.birthDay = this.birthDay.toString()
    }
    return data
  }
}

