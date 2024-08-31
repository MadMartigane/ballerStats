import { clone, getUniqId } from '../utils'
import {
  MatchRawData,
  MatchStatLogEntry,
  MatchType,
  MatchStatus,
} from './match.d'

const defaultType: MatchType = 'home'

export default class Match {
  #id = getUniqId()

  public opponent: string | null = null
  public type: MatchType = defaultType
  public teamId: string | null = null
  public stats: Array<MatchStatLogEntry> = []
  public status: MatchStatus = 'unlocked'

  constructor(data?: MatchRawData) {
    if (data) {
      this.setFromRawData(data)
    }
  }

  public get id() {
    return this.#id
  }

  public get isRegisterable() {
    return Boolean(this.opponent) && Boolean(this.type) && Boolean(this.teamId)
  }

  public setFromRawData(data: MatchRawData) {
    if (data.id) {
      this.#id = data.id
    }

    this.opponent = data.opponent || null
    this.type = data.type || defaultType
    this.teamId = data.teamId || null
    this.stats = data.stats || []
    this.status = data.status || 'unlocked'
  }

  public getRawData(): MatchRawData {
    return {
      id: this.#id,
      opponent: this.opponent,
      type: this.type,
      teamId: this.teamId,
      status: this.status,
      stats: clone(this.stats) as Array<MatchStatLogEntry>,
    }
  }

  public update(data: MatchRawData) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
  }
}
