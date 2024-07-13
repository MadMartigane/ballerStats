import { getUniqId } from '../utils'
import { BsPlayerRawData } from './player.d'

export default class BsPlayer {
  #id: number
  public firstName?: string
  public lastName?: string
  public jersayNumber?: string
  public licenseNumber?: string
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

  public getRowData(): BsPlayerRawData {
    const data: BsPlayerRawData = {
      id: this.#id,
    };

    if(this.firstName) {
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

  public update(data: BsPlayerRawData) {
    this.setFromRawData({
      ...this.getRowData(),
      ...data,
    })
  }
}
