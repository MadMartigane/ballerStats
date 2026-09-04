import { useNavigate } from '@solidjs/router'
import { Contact as ContactIcon, LayoutGrid, Save, UserPlus, X } from 'lucide-solid'
import { For, Show } from 'solid-js'
import bsEventBus from '../../libs/event-bus/event-bus'
import MadSignal from '../../libs/mad-signal'
import { ROUTE_TROMBI } from '../../libs/menu/routes'
import orchestrator from '../../libs/orchestrator/orchestrator'
import { deletePhotoAndFlag, setPhotoAndFlag } from '../../libs/photo-store/photo-store'
import Player, { LICENSE_NUMBER_MAX_LENGTH } from '../../libs/player/player'
import type { PlayerRawData } from '../../libs/player/player.d'
import { players } from '../../libs/players-store'
import { scrollBottom, scrollTop, toast } from '../../libs/utils/utils'
import BsCard from '../card/card'
import BsContactsEditor from '../contacts-editor/contacts-editor'
import BsEmptyPlayerFallback from '../empty-player-fallback/empty-player-fallback'
import BsInput from '../input/input'
import BsPhotoUpload from '../photo-upload/photo-upload'
import BsPlayer from '../player/player'

let isEditingNewPlayer = false
const isAddingPlayer: MadSignal<boolean> = new MadSignal(false)
const canAddPlayer: MadSignal<boolean> = new MadSignal(false)
const playerLength: MadSignal<number> = new MadSignal(orchestrator.Players.length)

let currentPlayer: Player | null = null
const pendingPhotoBlob: MadSignal<Blob | undefined> = new MadSignal<Blob | undefined>(undefined)
const pendingPhotoDelete: MadSignal<boolean> = new MadSignal(false)

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

function resetPhotoState() {
  pendingPhotoBlob.set(undefined)
  pendingPhotoDelete.set(false)
}

function resetCurrentPlayer() {
  currentPlayer = null
  canAddPlayer.set(false)
}

function startAddingNewPlayer() {
  isEditingNewPlayer = true
  currentPlayer = new Player()
  canAddPlayer.set(false)
  resetPhotoState()
  toggleAddPlayer(true)
  scrollTop()
}

function onPhotoChange(_hasPhoto: boolean, blob?: Blob) {
  if (blob) {
    pendingPhotoBlob.set(blob)
    pendingPhotoDelete.set(false)
  } else {
    pendingPhotoBlob.set(undefined)
    pendingPhotoDelete.set(true)
  }
}

function cancelAddingPlayer() {
  toggleAddPlayer(false)
  resetCurrentPlayer()
  resetPhotoState()
  scrollBottom()
}

function savePlayer() {
  registerPlayer()
    .then(() => scrollBottom())
    .catch(() => toast("Erreur lors de l'enregistrement du joueur.", 'error'))
}

function editPlayerFromTile(player: Player) {
  editPlayer(player)
  scrollTop()
}

async function registerPlayer() {
  if (!currentPlayer?.isRegisterable) {
    return
  }

  const blob = pendingPhotoBlob.get()
  const isDelete = pendingPhotoDelete.get()

  if (blob) {
    await setPhotoAndFlag(currentPlayer, blob)
  } else if (isDelete && currentPlayer.hasPhoto) {
    await deletePhotoAndFlag(currentPlayer)
  }

  if (isEditingNewPlayer) {
    orchestrator.Players.add(currentPlayer)
  } else {
    orchestrator.Players.updatePlayer(currentPlayer)
  }

  toggleAddPlayer(false)
  resetCurrentPlayer()
  resetPhotoState()
}

function editPlayer(player: Player) {
  isEditingNewPlayer = false
  currentPlayer = new Player(player.getRawData())
  canAddPlayer.set(currentPlayer.isRegisterable)
  resetPhotoState()
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
        <button class="btn btn-primary" onClick={startAddingNewPlayer} type="button">
          <UserPlus />
          Ajouter un joueur
        </button>
        <button class="btn btn-secondary" onClick={onTrombiClick} type="button">
          <LayoutGrid />
          Trombinoscope
        </button>
      </div>
    </div>
  )
}

function renderAddingPlayerCard() {
  return BsCard({
    body: (
      <>
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: form-level Enter submission is a legacy behavior preserved during audit fixes */}
        <form class="flex flex-col gap-2" onKeyDown={onSubmit}>
          <Show when={currentPlayer?.id}>
            <BsPhotoUpload
              hasPhoto={currentPlayer?.hasPhoto ?? false}
              onChange={onPhotoChange}
              playerId={currentPlayer?.id ?? ''}
            />
          </Show>
          {BsInput({
            label: 'Nom',
            onChange: (value: string) => {
              setNewPlayerData({ lastName: value })
            },
            placeholder: 'Dupont',
            type: 'text',
            value: currentPlayer?.lastName,
          })}
          {BsInput({
            label: 'Prénom',
            onChange: (value: string) => {
              setNewPlayerData({ firstName: value })
            },
            placeholder: 'Charlie',
            type: 'text',
            value: currentPlayer?.firstName,
          })}
          {BsInput({
            label: 'Numéro de maillot',
            onChange: (value: string) => {
              setNewPlayerData({ jerseyNumber: value })
            },
            placeholder: '01',
            type: 'text',
            value: currentPlayer?.jerseyNumber,
          })}
          {BsInput({
            label: 'Surnom',
            onChange: (value: string) => {
              setNewPlayerData({ nicName: value })
            },
            placeholder: 'The B',
            type: 'text',
            value: currentPlayer?.nicName,
          })}
          {BsInput({
            label: 'Numéro de licence',
            maxLength: LICENSE_NUMBER_MAX_LENGTH,
            onChange: (value: string) => {
              setNewPlayerData({ licenseNumber: value })
            },
            placeholder: 'AB123456789',
            type: 'text',
            value: currentPlayer?.licenseNumber,
          })}
          {BsInput({
            label: 'Téléphone',
            onChange: (value: string) => {
              setNewPlayerData({ phone: value })
            },
            placeholder: '06 12 34 56 78',
            type: 'text',
            value: currentPlayer?.phone,
          })}
          {BsInput({
            label: 'Email',
            onChange: (value: string) => {
              setNewPlayerData({ email: value })
            },
            placeholder: 'joueur@example.com',
            type: 'email',
            value: currentPlayer?.email,
          })}
        </form>
        <Show when={!isEditingNewPlayer && currentPlayer?.id}>
          {/* The Show condition above guarantees a non-null player with a truthy id when rendered. */}
          <BsContactsEditor playerId={currentPlayer?.id ?? ''} />
        </Show>
      </>
    ),
    footer: (
      <div class="footer-buttons-container">
        <button class="btn btn-primary btn-wide" onClick={cancelAddingPlayer} type="button">
          <X />
          Annuler
        </button>

        <button class="btn btn-primary btn-wide" disabled={!canAddPlayer.get()} onClick={savePlayer} type="button">
          {isEditingNewPlayer ? <UserPlus /> : <Save />}
          {isEditingNewPlayer ? 'Ajouter' : 'Enregistrer'}
        </button>
      </div>
    ),
    info: 'Les nom, prénom et numéro de maillot sont obligatoires',
    title: (
      <p class="flex flex-row gap-1">
        <ContactIcon />
        {isEditingNewPlayer ? 'Nouveau joueur' : 'Édition du joueur'}
      </p>
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
                  <BsPlayer onEdit={editPlayerFromTile} player={player} />
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
