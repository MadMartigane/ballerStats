import BsPlayers from '../players'
import utils from '../utils/utils'
export class Orchestrator {
  #id: number = utils.getUniqId()
  #players: BsPlayers = new BsPlayers()


  constructor() {
    console.log('#constructor - Orchestrator id: ', this.#id)
  }

  public init() {
    console.log('#init - Orchestrator id: ', this.#id)

  }

  public get players() {
    return this.#players;
  }
}

const orchestrator = new Orchestrator()
export default orchestrator
