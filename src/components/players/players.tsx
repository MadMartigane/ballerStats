import { Contact, MessageCircleWarning, Save, UserPlus, X } from 'lucide-solid'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import Player from '../../libs/player'
import { For, Show } from 'solid-js'
import BsCard from '../card'
import BsInput from '../input'
import { PlayerRawData } from '../../libs/player'
import BsPlayer from '../player'
import { createStore } from 'solid-js/store'
import { scrollBottom, scrollTop } from '../../libs/utils'

let isEditingNewPlayer: boolean = false
const isAddingPlayer: MadSignal<boolean> = new MadSignal(false)
const canAddPlayer: MadSignal<boolean> = new MadSignal(false)
const playerLength: MadSignal<number> = new MadSignal(
  orchestrator.Players.length,
)
const [players, setPlayers] = createStore(orchestrator.Players.players)

let currentPlayer: Player | null = null

bsEventBus.addEventListener('BS::PLAYERS::CHANGE', () => {
  playerLength.set(orchestrator.Players.length)
  setPlayers(orchestrator.Players.players)
})

function setNewPlayerData(data: PlayerRawData) {
  if (!currentPlayer) {
    currentPlayer = new Player(data)
  } else {
    currentPlayer.update(data)
  }

  canAddPlayer.set(currentPlayer.isRegisterable)
}

function toggleAddPlayer(value: boolean) {
  isAddingPlayer.set(value)
}

function registerPlayer() {
  if (!currentPlayer || !currentPlayer.isRegisterable) {
    return
  }

  if (isEditingNewPlayer) {
    orchestrator.Players.add(currentPlayer)
  } else {
    orchestrator.Players.updatePlayer(currentPlayer)
  }

  toggleAddPlayer(false)
  currentPlayer = null
  canAddPlayer.set(false)
}

function editPlayer(player: Player) {
  isEditingNewPlayer = false
  currentPlayer = new Player(player.getRawData())
  canAddPlayer.set(currentPlayer.isRegisterable)

  toggleAddPlayer(true)
}

function onSubmit(event: KeyboardEvent) {
  if (event.key !== 'Enter') {
    return
  }

  registerPlayer()
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
        <button
          class="btn btn-primary"
          onClick={() => {
            isEditingNewPlayer = true
            toggleAddPlayer(true)
            scrollTop()
          }}
        >
          <UserPlus />
          Ajouter un jouer
        </button>
      </div>
    </div>
  )
}

function renderAddingPlayerCard() {
  return BsCard({
    title: (
      <p class="flex flex-row gap-1">
        <Contact />
        {isEditingNewPlayer ? 'Nouveau joueur' : 'Édition du joueur'}
      </p>
    ),
    info: 'Les nom, prénom et numéro de maillot sont obligatoires',
    body: (
      <form class="flex flex-col gap-2" onKeyDown={onSubmit}>
        {BsInput({
          type: 'text',
          label: 'Nom',
          value: currentPlayer?.lastName,
          placeholder: 'Dupont',
          onChange: (value: string) => {
            setNewPlayerData({ lastName: value })
          },
        })}
        {BsInput({
          type: 'text',
          label: 'Prénom',
          value: currentPlayer?.firstName,
          placeholder: 'Charlie',
          onChange: (value: string) => {
            setNewPlayerData({ firstName: value })
          },
        })}
        {BsInput({
          type: 'text',
          label: 'Numéro de maillot',
          value: currentPlayer?.jersayNumber,
          placeholder: '01',
          onChange: (value: string) => {
            setNewPlayerData({ jersayNumber: value })
          },
        })}
        {BsInput({
          type: 'text',
          label: 'Surnom',
          value: currentPlayer?.nicName,
          placeholder: 'The B',
          onChange: (value: string) => {
            setNewPlayerData({ nicName: value })
          },
        })}
        {/* BsInput({
          type: 'text',
          label: 'Numéro de license',
          placeholder: '0123456789-abc',
          onChange: (value: string) => {
            setNewPlayerData({ licenseNumber: value })
          },
        }) */}
      </form>
    ),
    footer: (
      <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <button
          class="btn btn-primary btn-wide"
          onClick={() => {
            toggleAddPlayer(false)
            currentPlayer = null
            canAddPlayer.set(false)
            scrollBottom()
          }}
        >
          <X />
          Annuler
        </button>

        <button
          class="btn btn-primary btn-wide"
          disabled={!canAddPlayer.get()}
          onClick={() => {
            registerPlayer()
            scrollBottom()
          }}
        >
          {isEditingNewPlayer ? 'Ajouter' : 'Enregistrer'}
          {isEditingNewPlayer ? <UserPlus /> : <Save />}
        </button>
      </div>
    ),
  })
}

export default function BsPlayers() {
  return (
    <div>
      <Show when={!isAddingPlayer.get()}>
        <Show
          when={(playerLength.get() || 0) > 0}
          fallback={renderPlayerFallback()}
        >
          <div class="flex flex-wrap gap-4 justify-stretch">
            <For each={players}>
              {player => (
                <div class="mx-auto md:mx-0 w-fit">
                  <BsPlayer
                    player={player}
                    onEdit={player => {
                      editPlayer(player)
                      scrollTop()
                    }}
                  />
                </div>
              )}
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
