import utils from '../utils/utils'
export class Orchestrator {
  #id: number = utils.getUniqId()

  constructor() {
    console.log('Orchestrator id: ', this.#id)
  }
}

const orchestrator = new Orchestrator()
export default orchestrator
