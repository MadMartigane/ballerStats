import { createStore } from 'solid-js/store'
import bsEventBus from './event-bus/event-bus'
import orchestrator from './orchestrator/orchestrator'

const [clubs, setClubs] = createStore(orchestrator.Clubs.clubs)

bsEventBus.addEventListener('BS::CLUBS::CHANGE', () => {
  setClubs(orchestrator.Clubs.clubs)
})

export { clubs }
