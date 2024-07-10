import { MessageCircleWarning, UserPlus, X } from 'lucide-solid'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import BsPlayers from '../../libs/players'
import { For, Show } from 'solid-js'
import button from '../button'

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
    <div>
      <h4>
        <MessageCircleWarning size={42} color="warning" />
        <span class="px-2">Aucun joueur enregistré.</span>
      </h4>
    </div>
  )
}

function renderAddPlayerButton() {
  return (
    <div>
      <div>
        <div>
          {button({
            element: (
              <span>
                <X /> Annuler
              </span>
            ),
            onClick: () => {
              onAddPlayer(true)
            },
          })}
        </div>

        <div>
          {button({
            element: (
              <span>
                <UserPlus /> Ajouter un joueur
              </span>
            ),
            disabled: !canAddPlayer.get(),
            onClick: () => {
              onAddPlayer(true)
            },
          })}
        </div>
      </div>
    </div>
  )
}

function renderAddingPlayerdiv() {
  return (
    <div>
      {button({
        element: (
          <span>
            <UserPlus /> Ajouter
          </span>
        ),
        onClick: () => {
          onAddPlayer(true)
        },
      })}
    </div>
  )
}

export default function BsPlayersEl() {
  return (
    <div class="justify-center">
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
        {renderAddingPlayerdiv()}
      </Show>
    </div>
  )
}
