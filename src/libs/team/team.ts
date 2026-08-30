import { clone, getUniqId } from '../utils/utils'
import type { AgeCategory, MatchFormatConfig } from './match-format'
import type { TeamRawData } from './team.d'

export const TEAM_OPPONENT_ID = 'OPPONENT'

export default class Team {
  #id = getUniqId()
  #playerIds: string[] = []

  clubId?: string
  category?: AgeCategory | null
  matchFormat?: MatchFormatConfig | null
  name: string | null = null

  constructor(data?: TeamRawData) {
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

  get playerIds() {
    return clone(this.#playerIds) as string[]
  }

  setFromRawData(data: TeamRawData) {
    if (data.id) {
      this.#id = data.id
    }

    this.name = data.name || null
    this.clubId = data.clubId
    this.category = data.category || null
    this.matchFormat = data.matchFormat || null
    this.#playerIds = data.playerIds || []
  }

  getRawData(): TeamRawData {
    const data: TeamRawData = {
      id: this.#id,
      name: this.name,
      playerIds: <string[]>clone(this.#playerIds),
    }

    if (this.clubId) {
      data.clubId = this.clubId
    }

    if (this.category) {
      data.category = this.category
    }

    if (this.matchFormat) {
      data.matchFormat = { ...this.matchFormat }
    }

    return data
  }

  update(data: TeamRawData) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
  }
}
