import { createMemo } from 'solid-js'
import BsTrombi from '../components/trombi/trombi'
import Player, { sortPlayersByJersey } from '../libs/player/player'
import { players } from '../libs/stores/players-store'

export default function TrombiPage() {
  const sortedPlayers = createMemo(() => sortPlayersByJersey(players.map((raw) => new Player(raw))))
  return <BsTrombi players={sortedPlayers()} />
}
