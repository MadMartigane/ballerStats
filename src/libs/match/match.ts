import type { MatchFormatConfig } from '../team/match-format'
import { clone, getUniqId } from '../utils/utils'
import type { MatchRawData, MatchStatLogEntry, MatchStatus, MatchType } from './match.d'

const defaultType: MatchType = 'home'

export default class Match {
  #id = getUniqId()

  opponent: string | null = null
  type: MatchType = defaultType
  teamId: string | null = null
  stats: MatchStatLogEntry[] = []
  status: MatchStatus = 'unlocked'
  date: string | null = null
  championship: string | null = null
  playersInTheFive: string[] = []
  tablePlayTimes?: Record<string, number>
  matchFormat?: MatchFormatConfig | null

  constructor(data?: MatchRawData) {
    if (data) {
      this.setFromRawData(data)
    }
  }

  private setFromRawData(data: MatchRawData) {
    if (data.id) {
      this.#id = data.id
    }

    this.opponent = data.opponent || null
    this.type = data.type || defaultType
    this.teamId = data.teamId || null
    this.stats = data.stats || []
    this.status = data.status || 'unlocked'
    this.date = data.date || null
    this.championship = data.championship ?? null
    this.playersInTheFive = data.playersInTheFive || this.playersInTheFive
    this.tablePlayTimes = data.tablePlayTimes || undefined
    this.matchFormat = data.matchFormat || null
  }

  get id() {
    return this.#id
  }

  get isRegisterable() {
    return Boolean(this.opponent) && Boolean(this.type) && Boolean(this.teamId)
  }

  getRawData(): MatchRawData {
    const data: MatchRawData = {
      championship: this.championship,
      date: this.date || null,
      id: this.#id,
      opponent: this.opponent,
      playersInTheFive: [...this.playersInTheFive],
      stats: clone(this.stats) as MatchStatLogEntry[],
      status: this.status,
      teamId: this.teamId,
      type: this.type,
    }

    if (this.tablePlayTimes) {
      data.tablePlayTimes = { ...this.tablePlayTimes }
    }

    if (this.matchFormat) {
      data.matchFormat = { ...this.matchFormat }
    }

    return data
  }

  update(data: MatchRawData) {
    this.setFromRawData({
      ...this.getRawData(),
      ...data,
    })
  }
}
