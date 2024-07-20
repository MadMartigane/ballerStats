import { getUniqId } from '../utils'
import { TeamRawData } from './team.d'

export default class Team {
  #id: number = getUniqId()
  #playerIds: Array<number> = []

  public name: string | null = null

  constructor(data?: TeamRawData) {
    if (data) {
      this.setFromRawData(data)
    }
  }

  public get id() {
    return this.#id
  }

  public get isRegisterable() {
    return Boolean(this.name)
  }

  public get playerIds() {
    return JSON.parse(JSON.stringify(this.#playerIds))
  }
  public setFromRawData(data: TeamRawData) {
    if (data.id) {
      this.#id = data.id
    }

    this.name = data.name || null
    this.#playerIds = data.teamIds || []
  }

  public getRawData(): TeamRawData {
    return {
      id: this.#id,
      name: this.name,
      teamIds: JSON.parse(JSON.stringify(this.#playerIds)),
    }
  }

  public update(data: TeamRawData) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
  }
}
