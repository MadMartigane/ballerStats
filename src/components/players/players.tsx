import { Contact, MessageCircleWarning, UserPlus, X } from 'lucide-solid'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import BsPlayer from '../../libs/player'
import BsPlayers from '../../libs/players'
import { For, Show } from 'solid-js'
import button from '../button'
import card from '../card'
import input from '../input'
import { BsPlayerRawData } from '../../libs/player'

const players: MadSignal<BsPlayers> = new MadSignal(orchestrator.players)
const isAddingPlayer: MadSignal<boolean> = new MadSignal(false)
const canAddPlayer: MadSignal<boolean> = new MadSignal(false)
const mandatoryNewPlayerFields = ['lastName', 'firstName', 'jersayNumber']

let newPlayer: BsPlayer | null = null

bsEventBus.addEventListener('BS::PLAYERS::CHANGE', () => {
  players.set(orchestrator.players)
})

function setNewPlayerData(data: BsPlayerRawData) {
  if (!newPlayer) {
    newPlayer = new BsPlayer(data)
  } else {
    newPlayer.update(data)
  }

  console.log('Update new player: ', newPlayer)
  console.log('new player rawData: ', newPlayer.getRowData())
  const newPlayerRawData: { [key: string]: unknown } = newPlayer.getRowData()
  canAddPlayer.set(
    mandatoryNewPlayerFields.every(
      field => newPlayerRawData[field] !== undefined,
    ),
  )
  console.log('canAddPlayer: ', canAddPlayer.get())
}

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
    title: (
      <p class="flex flex-row gap-1">
        <Contact />
        Nouveau joueur
      </p>
    ),
    info: 'Les nom, prénom et numéro de maillot sont obligatoires',
    body: (
      <div class="flex flex-col gap-2">
        {input({
          type: 'text',
          label: 'Nom',
          placeholder: 'Dupont',
          onChange: (value: string) => {
            setNewPlayerData({ lastName: value })
          },
        })}
        {input({
          type: 'text',
          label: 'Prénom',
          placeholder: 'Charlie',
          onChange: (value: string) => {
            setNewPlayerData({ firstName: value })
          },
        })}
        {input({
          type: 'text',
          label: 'Numéro de maillot',
          placeholder: '01',
          onChange: (value: string) => {
            setNewPlayerData({ jersayNumber: value })
          },
        })}
      </div>
    ),
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
