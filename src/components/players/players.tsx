import { Box, Button, Typography } from '@suid/material'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import BsPlayers from '../../libs/players'
import { For, Show } from 'solid-js'
import { PersonAdd, Report } from '@suid/icons-material'

const players: MadSignal<BsPlayers> = new MadSignal(orchestrator.players)

bsEventBus.addEventListener('BS::PLAYERS::CHANGE', () => {
  players.set(orchestrator.players)
})

function noPlayerFallbackEl() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        <Report fontSize="large" color="warning" />
        <span class="px-2">Aucun joueur enregistré.</span>
      </Typography>

      <Button variant="contained" startIcon={<PersonAdd />}>
        Ajouter un joueur
      </Button>
    </Box>
  )
}

export default function BsPlayersEl() {
  return (
    <Box>
      <Typography variant="h3" gutterBottom>
        Gestion des joueurs
      </Typography>

      <Show
        when={players.get()?.players.length || 0 > 0}
        fallback={noPlayerFallbackEl()}
      >
        <ul>
          <For each={players.get()?.players}>
            {(player, index) => (
              <li
                style={{
                  color: index() % 2 === 0 ? 'red' : 'blue',
                }}
              >
                #{player.jersayNumber} {player.firstName} - {player.lastName} (
                {player.jersayNumber})
              </li>
            )}
          </For>
        </ul>
      </Show>
    </Box>
  )
}
