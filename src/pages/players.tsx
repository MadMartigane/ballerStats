import { Box } from '@suid/material'
import BsPlayers from '../libs/players'
console.log('BsPlayers: ', BsPlayers)

const bsPlayers = new BsPlayers()
console.log('BsPlayers: ', bsPlayers)

export default function players() {
  return (
    <Box>
      <h1 class="text-2xl font-bold">Joueurs</h1>

      <p class="mt-4">Liste des joueurs.</p>
    </Box>
  )
}
