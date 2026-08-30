import { clone, getUniqId } from '../utils/utils'
import type { TeamRawData } from './team.d'

export const TEAM_OPPONENT_ID = 'OPPONENT'

export default class Team {
  #id = getUniqId()
  #playerIds: string[] = []
  #updatedAt = Date.now()
  #deletedAt: number | null = null

  name: string | null = null

  constructor(data?: TeamRawData) {
    this.#updatedAt = data?.updatedAt ?? (data?.id ? 0 : Date.now())
    this.#deletedAt = data?.deletedAt ?? null

    if (data) {
      this.setFromRawData(data)
    }
  }

  get id() {
    return this.#id
  }

  get updatedAt() {
    return this.#updatedAt
  }

  get deletedAt() {
    return this.#deletedAt
  }

  /** Stamp the entity as modified now. Mutable operations must call this. */
  private touch() {
    this.#updatedAt = Date.now()
  }

  /** Soft-delete: keep the record, stamp it as deleted. */
  markAsDeleted() {
    this.#deletedAt = Date.now()
    this.touch()
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
    if (data.updatedAt !== undefined) {
      this.#updatedAt = data.updatedAt
    }
    if (data.deletedAt !== undefined) {
      this.#deletedAt = data.deletedAt
    }

    this.name = data.name || null
    this.#playerIds = data.playerIds || []
  }

  getRawData(): TeamRawData {
    return {
      deletedAt: this.#deletedAt,
      id: this.#id,
      name: this.name,
      playerIds: <string[]>clone(this.#playerIds),
      updatedAt: this.#updatedAt,
    }
  }

  update(data: TeamRawData) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
    this.touch()
  }
}
