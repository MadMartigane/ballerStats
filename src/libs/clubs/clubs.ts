import Club from '../club/club'
import type { ClubRawData } from '../club/club.d'
import bsEventBus from '../event-bus/event-bus'

export default class Clubs {
  #clubs: Club[] = []

  constructor(clubDatas?: ClubRawData[]) {
    if (clubDatas) {
      this.setFromRawData(clubDatas)
    }
  }

  private throwUpdatedClubEvent() {
    bsEventBus.dispatchEvent('BS::CLUBS::CHANGE')
  }

  private getClub(newClub: Club) {
    return this.#clubs.find((currentClub) => currentClub.id === newClub.id)
  }

  get clubs(): Club[] {
    return this.#clubs.map((club: Club): Club => new Club(club.getRawData()))
  }

  get length() {
    return this.#clubs.length
  }

  setFromRawData(data: ClubRawData[]) {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: legacy callers/tests pass null to empty the collection, which the array parameter type does not reflect.
    if (!data) {
      this.#clubs = []
      return
    }

    this.#clubs = data.map((clubData: ClubRawData) => new Club(clubData))
  }

  updateClub(newClub: Club) {
    const oldClub = this.#clubs.find((currentClub) => currentClub.id === newClub.id)
    if (!oldClub) {
      throw new Error(
        `[BsClubs.updateClub()] The club id ${newClub.id} doesn't exist, Please use .add() method instead.`
      )
    }

    oldClub.setFromRawData(newClub.getRawData())
    this.throwUpdatedClubEvent()
  }

  getRawData() {
    return this.#clubs.map((club: Club) => club.getRawData())
  }

  add(newClub: Club) {
    if (!newClub.isRegisterable) {
      throw new Error(`[BsClubs.add()] The club id ${newClub.id} is not registerable, Please complete the data.`)
    }

    const alreadyRegisteredClub = this.getClub(newClub)
    if (alreadyRegisteredClub) {
      throw new Error(
        `[BsClubs.add()] The club id ${newClub.id} already exist, Please use .updateClub() method instead.`
      )
    }

    this.#clubs.push(newClub)
    this.throwUpdatedClubEvent()
  }

  remove(club: Club) {
    const idx = this.#clubs.findIndex((candidate: Club) => candidate.id === club.id)

    if (idx === -1) {
      throw new Error(`[BsClubs.remove()] The club id ${club.id} not found, Unable to remove it.`)
    }

    this.#clubs.splice(idx, 1)
    this.throwUpdatedClubEvent()
  }
}
