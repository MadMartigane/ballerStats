import bsEventBus from '../event-bus'
import Team, { type TeamRawData } from '../team'

export default class Teams {
  #teams: Array<Team> = []

  constructor(teamDatas?: Array<TeamRawData>) {
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

  public get teams(): Array<Team> {
    return this.#teams.map((team: Team): Team => {
      return new Team(team.getRawData())
    })
  }

  public get length() {
    return this.#teams.length
  }

  public setFromRawData(data: Array<TeamRawData>) {
    if (!data) {
      this.#teams = []
      return
    }

    this.#teams = data.map((teamData: TeamRawData) => new Team(teamData))
  }

  public updateTeam(newTeam: Team) {
    const oldTeam = this.#teams.find((currentTeam) => currentTeam.id === newTeam.id)
    if (!oldTeam) {
      throw new Error(
        `[BsTeams.updateTeam()] The team id ${newTeam.id} doesn't exist, Please use .add() method instead.`,
      )
    }

    oldTeam.setFromRawData(newTeam.getRawData())
    this.throwUpdatedTeamEvent()
  }

  public getRawData() {
    return this.#teams.map((team: Team) => team.getRawData())
  }

  public add(newTeam: Team) {
    if (!newTeam.isRegisterable) {
      throw new Error(`[BsTeams.add()] The team id ${newTeam.id} is not registerable, Please complete the data.`)
    }

    const alreadyRegisteredTeam = this.getTeam(newTeam)
    if (alreadyRegisteredTeam) {
      throw new Error(
        `[BsTeams.add()] The team id ${newTeam.id} already exist, Please use .updateTeam() method instead.`,
      )
    }

    this.#teams.push(newTeam)
    this.throwUpdatedTeamEvent()
  }

  public remove(team: Team) {
    const idx = this.#teams.findIndex((candidate: Team) => candidate.id === team.id)

    if (idx === -1) {
      throw new Error(`[BsTeams.remove()] The team id ${team.id} not found, Unable to remove it.`)
    }

    this.#teams.splice(idx, 1)
    this.throwUpdatedTeamEvent()
  }
}
