import Match from '../match'
import type { MatchRawData } from '../match'
import bsEventBus from '../event-bus'

export default class Matchs {
  #matchs: Array<Match> = []

  constructor(matchDatas?: Array<MatchRawData>) {
    if (matchDatas) {
      this.setFromRawData(matchDatas)
    }
  }

  private throwUpdatedMatchEvent() {
    bsEventBus.dispatchEvent('BS::MATCHS::CHANGE')
  }

  private getMatch(newMatch: Match) {
    return this.#matchs.find(currentMatch => currentMatch.id === newMatch.id)
  }

  public get matchs(): Array<Match> {
    return this.#matchs.map((match: Match): Match => {
      return new Match(match.getRawData())
    })
  }

  public get length() {
    return this.#matchs.length
  }

  public setFromRawData(data: Array<MatchRawData>) {
    if (!data) {
      this.#matchs = []
      return
    }

    this.#matchs = data.map((matchData: MatchRawData) => new Match(matchData))
  }

  public updateMatch(newMatch: Match) {
    const oldMatch = this.#matchs.find(
      currentMatch => currentMatch.id === newMatch.id,
    )
    if (!oldMatch) {
      throw new Error(
        `[BsMatchs.updateMatch()] The match id ${newMatch.id} doesn't exist, Please use .add() method instead.`,
      )
    }

    console.log("old match raw data: ", oldMatch.getRawData())
    console.log("new match raw data: ", newMatch.getRawData())
    oldMatch.setFromRawData(newMatch.getRawData())
    this.throwUpdatedMatchEvent()
  }

  public getRawData() {
    return this.#matchs.map((match: Match) => match.getRawData())
  }

  public add(newMatch: Match) {
    if (!newMatch.isRegisterable) {
      throw new Error(
        `[BsMatchs.add()] The match id ${newMatch.id} is not registerable, Please complete the data.`,
      )
    }

    const alreadyRegisteredMatch = this.getMatch(newMatch)
    if (alreadyRegisteredMatch) {
      throw new Error(
        `[BsMatchs.add()] The match id ${newMatch.id} already exist, Please use .updateMatch() method instead.`,
      )
    }

    this.#matchs.push(newMatch)
    this.throwUpdatedMatchEvent()
  }

  public remove(match: Match) {
    const idx = this.#matchs.findIndex(
      (candidate: Match) => candidate.id === match.id,
    )

    if (idx === -1) {
      throw new Error(
        `[BsMatchs.remove()] The match id ${match.id} not found, Unable to remove it.`,
      )
    }

    this.#matchs.splice(idx, 1)
    this.throwUpdatedMatchEvent()
  }
}
