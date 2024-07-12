import { Contact, MessageCircleWarning, UserPlus, X } from 'lucide-solid'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import BsPlayers from '../../libs/players'
import { For, Show } from 'solid-js'
import button from '../button'
import card from '../card'
import input from '../input'

const players: MadSignal<BsPlayers> = new MadSignal(orchestrator.players)
const isAddingPlayer: MadSignal<boolean> = new MadSignal(false)
const canAddPlayer: MadSignal<boolean> = new MadSignal(false)

bsEventBus.addEventListener('BS::PLAYERS::CHANGE', () => {
  players.set(orchestrator.players)
})

function toggleAddPlayer(value: boolean) {
  isAddingPlayer.set(value)
}

function renderPlayerFallback() {
  return (
    <div>
      <h4 class="inline-flex items-end my-4">
        <MessageCircleWarning size={42} />
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
            slotStart: <UserPlus />,
            element: 'Ajouter un jouer',
            onClick: () => {
              toggleAddPlayer(true)
            },
          })}
        </div>
      </div>
    </div>
  )
}

function renderAddingPlayerCard() {
  return card({
    title: (<p class="flex flex-row gap-1"><Contact />Nouveau joueur</p>),
    info: 'simple information',
    body: (<div>
      {input({
        type: 'text',
        label: 'Nom',
        placeholder: 'Charlie'

      })}
    </div>),
    footer: (
      <div class="grid grid-cols-2 gap-2">
        {button({
          wide: true,
          slotStart: <X />,
          element: 'Annuler',
          onClick: () => {
            toggleAddPlayer(false)
          },
        })}

        {button({
          wide: true,
          slotStart: <UserPlus />,
          element: 'Ajouter',
          disabled: !canAddPlayer.get(),
          onClick: () => {
            toggleAddPlayer(false)
          },
        })}
      </div>
    ),
  })
}

export default function BsPlayersEl() {
  return (
    <div>
      <Show when={!isAddingPlayer.get()}>
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
                  #{player.jersayNumber} {player.firstName} - {player.lastName}{' '}
                  ({player.jersayNumber})
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>
      <Show when={isAddingPlayer.get()} fallback={renderAddPlayerButton()}>
        {renderAddingPlayerCard()}
      </Show>
    </div>
  )
}
