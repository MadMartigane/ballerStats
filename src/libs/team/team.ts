import { clone, getUniqId } from '../utils/utils'
import type { TeamRawData } from './team.d'

export const TEAM_OPPONENT_ID = 'OPPONENT'

export default class Team {
  #id = getUniqId()
  #playerIds: string[] = []

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
    this.#playerIds = data.playerIds || []
  }

  getRawData(): TeamRawData {
    return {
      id: this.#id,
      name: this.name,
      playerIds: <string[]>clone(this.#playerIds),
    }
  }

  update(data: TeamRawData) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
  }
}
