import { Contact, LayoutGrid, Save, UserPlus, X } from 'lucide-solid'
import { useNavigate } from '@solidjs/router'
import { For, Show } from 'solid-js'
import bsEventBus from '../../libs/event-bus'
import MadSignal from '../../libs/mad-signal'
import { ROUTE_TROMBI } from '../../libs/menu/routes'
import orchestrator from '../../libs/orchestrator/orchestrator'
import type { PlayerRawData } from '../../libs/player'
import Player, { LICENSE_NUMBER_MAX_LENGTH } from '../../libs/player'
import { players } from '../../libs/players-store'
import { scrollBottom, scrollTop } from '../../libs/utils'
import BsCard from '../card'
import BsEmptyPlayerFallback from '../empty-player-fallback'
import BsInput from '../input'
import BsPlayer from '../player'

let isEditingNewPlayer = false
const isAddingPlayer: MadSignal<boolean> = new MadSignal(false)
const canAddPlayer: MadSignal<boolean> = new MadSignal(false)
const playerLength: MadSignal<number> = new MadSignal(orchestrator.Players.length)

let currentPlayer: Player | null = null

bsEventBus.addEventListener('BS::PLAYERS::CHANGE', () => {
  playerLength.set(orchestrator.Players.length)
})

function setNewPlayerData(data: PlayerRawData) {
  if (currentPlayer) {
    currentPlayer.update(data)
  } else {
    currentPlayer = new Player(data)
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

function renderAddPlayerButton(onTrombiClick: () => void) {
  return (
    <div class="w-full">
      <hr />
      <div class="footer-buttons-container">
        <button
          class="btn btn-primary"
          onClick={() => {
            isEditingNewPlayer = true
            toggleAddPlayer(true)
            scrollTop()
          }}
          type="button"
        >
          <UserPlus />
          Ajouter un joueur
        </button>
        <button
          class="btn btn-secondary"
          onClick={onTrombiClick}
          type="button"
        >
          <LayoutGrid />
          Trombinoscope
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
        {BsInput({
          type: 'text',
          label: 'Numéro de licence',
          maxLength: LICENSE_NUMBER_MAX_LENGTH,
          placeholder: 'AB123456789',
          value: currentPlayer?.licenseNumber,
          onChange: (value: string) => {
            setNewPlayerData({ licenseNumber: value })
          },
        })}
      </form>
    ),
    footer: (
      <div class="footer-buttons-container">
        <button
          class="btn btn-primary btn-wide"
          onClick={() => {
            toggleAddPlayer(false)
            currentPlayer = null
            canAddPlayer.set(false)
            scrollBottom()
          }}
          type="button"
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
          type="button"
        >
          {isEditingNewPlayer ? 'Ajouter' : 'Enregistrer'}
          {isEditingNewPlayer ? <UserPlus /> : <Save />}
        </button>
      </div>
    ),
  })
}

export default function BsPlayers() {
  const navigate = useNavigate()

  return (
    <div>
      <Show when={!isAddingPlayer.get()}>
        <Show fallback={<BsEmptyPlayerFallback />} when={(playerLength.get() || 0) > 0}>
          <div class="flex w-full flex-wrap justify-around gap-4">
            <For each={players}>
              {(player) => (
                <div class="mx-auto w-fit md:mx-0">
                  <BsPlayer
                    onEdit={(player) => {
                      editPlayer(player)
                      scrollTop()
                    }}
                    player={player}
                  />
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
      <Show fallback={renderAddPlayerButton(() => navigate(ROUTE_TROMBI))} when={isAddingPlayer.get()}>
        {renderAddingPlayerCard()}
      </Show>
    </div>
  )
}
