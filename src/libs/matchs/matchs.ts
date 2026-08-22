import bsEventBus from '../event-bus/event-bus'
import Match from '../match/match'
import type { MatchRawData } from '../match/match.d'

export default class Matchs {
  #matchs: Match[] = []

  constructor(matchDatas?: MatchRawData[]) {
    if (matchDatas) {
      this.setFromRawData(matchDatas)
    }
  }

  private throwUpdatedMatchEvent() {
    bsEventBus.dispatchEvent('BS::MATCHS::CHANGE')
  }

  private getMatch(newMatch: Match) {
    return this.#matchs.find((currentMatch) => currentMatch.id === newMatch.id)
  }

  get matchs(): Match[] {
    return this.#matchs.map((match: Match): Match => new Match(match.getRawData()))
  }

  get length() {
    return this.#matchs.length
  }

  setFromRawData(data: MatchRawData[]) {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: legacy callers/tests pass null to empty the collection, which the array parameter type does not reflect.
    if (!data) {
      this.#matchs = []
      return
    }

    this.#matchs = data.map((matchData: MatchRawData) => new Match(matchData))
  }

  updateMatch(newMatch: Match) {
    const oldMatch = this.#matchs.find((currentMatch) => currentMatch.id === newMatch.id)
    if (!oldMatch) {
      throw new Error(
        `[BsMatchs.updateMatch()] The match id ${newMatch.id} doesn't exist, Please use .add() method instead.`
      )
    }

    oldMatch.update(newMatch.getRawData())
    this.throwUpdatedMatchEvent()
  }

  getRawData() {
    return this.#matchs.map((match: Match) => match.getRawData())
  }

  add(newMatch: Match) {
    if (!newMatch.isRegisterable) {
      throw new Error(`[BsMatchs.add()] The match id ${newMatch.id} is not registerable, Please complete the data.`)
    }

    const alreadyRegisteredMatch = this.getMatch(newMatch)
    if (alreadyRegisteredMatch) {
      throw new Error(
        `[BsMatchs.add()] The match id ${newMatch.id} already exist, Please use .updateMatch() method instead.`
      )
    }

    this.#matchs.push(newMatch)
    this.throwUpdatedMatchEvent()
  }

  remove(match: Match) {
    const idx = this.#matchs.findIndex((candidate: Match) => candidate.id === match.id)

    if (idx === -1) {
      throw new Error(`[BsMatchs.remove()] The match id ${match.id} not found, Unable to remove it.`)
    }

    this.#matchs.splice(idx, 1)
    this.throwUpdatedMatchEvent()
  }
}
