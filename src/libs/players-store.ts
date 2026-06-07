import { createStore } from 'solid-js/store'
import bsEventBus from './event-bus'
import orchestrator from './orchestrator/orchestrator'

const [players, setPlayers] = createStore(orchestrator.Players.players)

bsEventBus.addEventListener('BS::PLAYERS::CHANGE', () => {
  setPlayers(orchestrator.Players.players)
})

export { players }
