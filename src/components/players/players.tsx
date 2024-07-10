import { Grid, Box, Button } from '@suid/material'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import BsPlayers from '../../libs/players'
import { For, Show } from 'solid-js'
import { Close, PersonAdd, Report } from '@suid/icons-material'

const players: MadSignal<BsPlayers> = new MadSignal(orchestrator.players)
const isAddingPlayer: MadSignal<boolean> = new MadSignal(false)
const canAddPlayer: MadSignal<boolean> = new MadSignal(false)

bsEventBus.addEventListener('BS::PLAYERS::CHANGE', () => {
  players.set(orchestrator.players)
})

function onAddPlayer(value: boolean) {
  isAddingPlayer.set(value)
}

function renderPlayerFallback() {
  return (
    <Box>
      <h4>
        <Report fontSize="large" color="warning" />
        <span class="px-2">Aucun joueur enregistré.</span>
      </h4>
    </Box>
  )
}

function renderAddPlayerButton() {
  return (
    <div>
      <Grid container spacing={2}>
        <Grid item xs={6} md={8}>
          <Button
            variant="contained"
            startIcon={<Close />}
            onClick={() => {
              onAddPlayer(true)
            }}
          >
            Annuler
          </Button>
        </Grid>

        <Grid item xs={6} md={8}>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            disabled={!canAddPlayer.get()}
            onClick={() => {
              onAddPlayer(true)
            }}
          >
            Ajouter un joueur
          </Button>
        </Grid>
      </Grid>
    </div>
  )
}

function renderAddingPlayerBox() {
  return (
    <div>
      <Button
        variant="contained"
        startIcon={<PersonAdd />}
        onClick={() => {
          onAddPlayer(false)
        }}
      >
        Ajouter
      </Button>
    </div>
  )
}

export default function BsPlayersEl() {
  return (
    <Box class="justify-center">
      <h3>Gestion des joueurs</h3>

      <Show
        when={players.get()?.players.length || 0 > 0}
        fallback={renderPlayerFallback()}
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
      <Show when={isAddingPlayer.get()} fallback={renderAddPlayerButton()}>
        {renderAddingPlayerBox()}
      </Show>
    </Box>
  )
}
