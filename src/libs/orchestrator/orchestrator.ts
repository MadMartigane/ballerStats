import BsPlayers from '../players'

export class Orchestrator {
  #players: BsPlayers = new BsPlayers()

  public get players() {
    return this.#players
  }
}

console.log('Orchestrator: ', Orchestrator)
const orchestrator = new Orchestrator()
console.log('orchestrator: ', orchestrator)
export default orchestrator
