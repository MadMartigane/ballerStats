import { Contact, MessageCircleWarning, UserPlus, X } from 'lucide-solid'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import Player from '../../libs/player'
import Players from '../../libs/players'
import { For, Show } from 'solid-js'
import Button from '../button'
import Card from '../card'
import Input from '../input'
import { PlayerRawData } from '../../libs/player'
import PlayerEl from '../player/player'

const players: MadSignal<Players> = new MadSignal(orchestrator.players)
const isAddingPlayer: MadSignal<boolean> = new MadSignal(false)
const canAddPlayer: MadSignal<boolean> = new MadSignal(false)

let newPlayer: Player | null = null

bsEventBus.addEventListener('BS::PLAYERS::CHANGE', () => {
  console.log('received BS::PLAYERS::CHANGE event')
  players.set(orchestrator.players)
  console.log('Update new players: ', orchestrator.players)
})

function setNewPlayerData(data: PlayerRawData) {
  if (!newPlayer) {
    newPlayer = new Player(data)
  } else {
    newPlayer.update(data)
  }

  console.log('Update new player: ', newPlayer)
  console.log('new player rawData: ', newPlayer.getRowData())
  canAddPlayer.set(newPlayer.isRegisterable)
  console.log('canAddPlayer: ', canAddPlayer.get())
}

function toggleAddPlayer(value: boolean) {
  isAddingPlayer.set(value)
}

function registerNewPlayer() {
  console.log('register new player.')
  if (!newPlayer || !newPlayer.isRegisterable) {
    throw new Error(
      '<Players::registerNewPlayer()> the new player is not registerable, please fill up more data.',
    )
  }

  console.log('adding new player: ', newPlayer)
  orchestrator.players.add(newPlayer)
  isAddingPlayer.set(false)
}

function renderPlayerFallback() {
  return (
    <div>
      <h4 class="inline-flex items-end my-4">
        <MessageCircleWarning class="w-14 h-14" />
        <span class="px-2">Aucun joueur enregistré.</span>
      </h4>
    </div>
  )
}

function renderAddPlayerButton() {
  return (
    <div>
      <hr />
      <div class="p-4">
        <div>
          {Button({
            slotStart: <UserPlus />,
            children: 'Ajouter un jouer',
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
  return Card({
    title: (
      <p class="flex flex-row gap-1">
        <Contact />
        Nouveau joueur
      </p>
    ),
    info: 'Les nom, prénom et numéro de maillot sont obligatoires',
    body: (
      <div class="flex flex-col gap-2">
        {Input({
          type: 'text',
          label: 'Nom',
          placeholder: 'Dupont',
          onChange: (value: string) => {
            setNewPlayerData({ lastName: value })
          },
        })}
        {Input({
          type: 'text',
          label: 'Prénom',
          placeholder: 'Charlie',
          onChange: (value: string) => {
            setNewPlayerData({ firstName: value })
          },
        })}
        {Input({
          type: 'text',
          label: 'Numéro de maillot',
          placeholder: '01',
          onChange: (value: string) => {
            setNewPlayerData({ jersayNumber: value })
          },
        })}
        {Input({
          type: 'text',
          label: 'Numéro de license',
          placeholder: '0123456789-abc',
          onChange: (value: string) => {
            setNewPlayerData({ licenseNumber: value })
          },
        })}
        {Input({
          type: 'text',
          label: 'Surnom',
          placeholder: 'The B',
          onChange: (value: string) => {
            setNewPlayerData({ nicName: value })
          },
        })}
      </div>
    ),
    footer: (
      <div class="grid grid-cols-2 gap-2">
        <Button
          wide={true}
          slotStart={<X />}
          onClick={() => {
            toggleAddPlayer(false)
          }}
        >
          Annuler
        </Button>
        <Button
          wide={true}
          slotStart={<UserPlus />}
          disabled={!canAddPlayer.get()}
          onClick={() => {
            registerNewPlayer()
          }}
        >
          Ajouter
        </Button>
      </div>
    ),
  })
}

export default function PlayersEl() {
  return (
    <div>
      <Show when={!isAddingPlayer.get()}>
        <Show
          when={players.get()?.players.length || 0 > 0}
          fallback={renderPlayerFallback()}
        >
          <div class="flex flex-row gap-4">
            <For each={players.get()?.players}>
              {player => <PlayerEl player={player} />}
            </For>
          </div>
        </Show>
      </Show>
      <Show when={isAddingPlayer.get()} fallback={renderAddPlayerButton()}>
        {renderAddingPlayerCard()}
      </Show>
    </div>
  )
}
