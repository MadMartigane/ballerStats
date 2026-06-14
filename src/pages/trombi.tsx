import { createMemo } from 'solid-js'
import BsTrombi from '../components/trombi/trombi'
import { sortPlayersByJersey } from '../libs/player'
import { players } from '../libs/players-store'

export default function TrombiPage() {
  const sortedPlayers = createMemo(() => sortPlayersByJersey(players))
  return <BsTrombi players={sortedPlayers()} />
}
