import { clone, getUniqId } from '../utils/utils'
import type { MatchRawData, MatchStatLogEntry, MatchStatus, MatchType } from './match.d'

const defaultType: MatchType = 'home'

export default class Match {
  #id = getUniqId()
  #updatedAt = Date.now()
  #deletedAt: number | null = null

  opponent: string | null = null
  type: MatchType = defaultType
  teamId: string | null = null
  stats: MatchStatLogEntry[] = []
  status: MatchStatus = 'unlocked'
  date: string | null = null
  championship: string | null = null
  playersInTheFive: string[] = []

  constructor(data?: MatchRawData) {
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

  private setFromRawData(data: MatchRawData) {
    if (data.id) {
      this.#id = data.id
    }
    if (data.updatedAt !== undefined) {
      this.#updatedAt = data.updatedAt
    }
    if (data.deletedAt !== undefined) {
      this.#deletedAt = data.deletedAt
    }

    this.opponent = data.opponent || null
    this.type = data.type || defaultType
    this.teamId = data.teamId || null
    this.stats = data.stats || []
    this.status = data.status || 'unlocked'
    this.date = data.date || null
    this.championship = data.championship ?? null
    this.playersInTheFive = data.playersInTheFive || this.playersInTheFive
  }

  get isRegisterable() {
    return Boolean(this.opponent) && Boolean(this.type) && Boolean(this.teamId)
  }

  getRawData(): MatchRawData {
    return {
      championship: this.championship,
      date: this.date || null,
      deletedAt: this.#deletedAt,
      id: this.#id,
      opponent: this.opponent,
      playersInTheFive: [...this.playersInTheFive],
      stats: clone(this.stats) as MatchStatLogEntry[],
      status: this.status,
      teamId: this.teamId,
      type: this.type,
      updatedAt: this.#updatedAt,
    }
  }

  update(data: MatchRawData) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
    this.touch()
  }
}
