import { getUniqId } from '../utils'
import { MatchRawData, MatchType } from './match.d'

const defaultType: MatchType = 'home'

export default class Match {
  #id: number = getUniqId()

  public opponent: string | null = null
  public type: MatchType = defaultType
  public teamId: number | null = null

  constructor(data?: MatchRawData) {
    if (data) {
      this.setFromRawData(data)
    }
  }

  public get id() {
    return this.#id
  }

  public get isRegisterable() {
    return Boolean(this.opponent) && Boolean(this.type)
  }

  public setFromRawData(data: MatchRawData) {
    if (data.id) {
      this.#id = data.id
    }

    this.opponent = data.opponent || null
    this.type = data.type || defaultType
    this.teamId = data.teamId || null
  }

  public getRawData(): MatchRawData {
    return {
      id: this.#id,
      opponent: this.opponent,
      type: this.type,
      teamId: this.teamId,
    }
  }

  public update(data: MatchRawData) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
  }
}
