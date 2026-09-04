import bsEventBus from '../event-bus/event-bus'
import Team from '../team/team'
import type { TeamRawData } from '../team/team.d'

export default class Teams {
  #teams: Team[] = []

  constructor(teamDatas?: TeamRawData[]) {
    if (teamDatas) {
      this.setFromRawData(teamDatas)
    }
  }

  private throwUpdatedTeamEvent() {
    bsEventBus.dispatchEvent('BS::TEAMS::CHANGE')
  }

  private getTeam(newTeam: Team) {
    return this.#teams.find((currentTeam) => currentTeam.id === newTeam.id)
  }

  get teams(): Team[] {
    return this.#teams.map((team: Team): Team => new Team(team.getRawData()))
  }

  get length() {
    return this.#teams.length
  }

  setFromRawData(data: TeamRawData[]) {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: legacy callers/tests pass null to empty the collection, which the array parameter type does not reflect.
    if (!data) {
      this.#teams = []
      return
    }

    this.#teams = data.map((teamData: TeamRawData) => new Team(teamData))
  }

  updateTeam(newTeam: Team) {
    const oldTeam = this.#teams.find((currentTeam) => currentTeam.id === newTeam.id)
    if (!oldTeam) {
      throw new Error(
        `[BsTeams.updateTeam()] The team id ${newTeam.id} doesn't exist, Please use .add() method instead.`
      )
    }

    oldTeam.setFromRawData(newTeam.getRawData())
    this.throwUpdatedTeamEvent()
  }

  getRawData() {
    return this.#teams.map((team: Team) => team.getRawData())
  }

  add(newTeam: Team) {
    if (!newTeam.isRegisterable) {
      throw new Error(`[BsTeams.add()] The team id ${newTeam.id} is not registerable, Please complete the data.`)
    }

    const alreadyRegisteredTeam = this.getTeam(newTeam)
    if (alreadyRegisteredTeam) {
      throw new Error(
        `[BsTeams.add()] The team id ${newTeam.id} already exist, Please use .updateTeam() method instead.`
      )
    }

    this.#teams.push(newTeam)
    this.throwUpdatedTeamEvent()
  }

  remove(team: Team) {
    const idx = this.#teams.findIndex((candidate: Team) => candidate.id === team.id)

    if (idx === -1) {
      throw new Error(`[BsTeams.remove()] The team id ${team.id} not found, Unable to remove it.`)
    }

    this.#teams.splice(idx, 1)
    this.throwUpdatedTeamEvent()
  }
}
