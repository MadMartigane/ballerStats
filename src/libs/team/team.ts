import { getUniqId } from '../utils'
import { TeamRawData } from './team.d'
import { clone } from '../utils'

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
    return clone(this.#playerIds) as number[]
  }

  public setFromRawData(data: TeamRawData) {
    if (data.id) {
      this.#id = data.id
    }

    this.name = data.name || null
    this.#playerIds = data.playerIds || []
  }

  public getRawData(): TeamRawData {
    return {
      id: this.#id,
      name: this.name,
      playerIds: <number[]>clone(this.#playerIds),
    }
  }

  public update(data: TeamRawData) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
  }
}
