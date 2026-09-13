import { useNavigate } from '@solidjs/router'
import { Contact as ContactIcon, LayoutGrid, Save, UserPlus, X } from 'lucide-solid'
import { type Accessor, createMemo, createSignal, For, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { ContactRawData } from '../../libs/contact/contact.d'
import { ROUTE_TROMBI } from '../../libs/menu/routes'
import orchestrator from '../../libs/orchestrator/orchestrator'
import Player, { LICENSE_NUMBER_MAX_LENGTH } from '../../libs/player/player'
import type { PlayerRawData } from '../../libs/player/player.d'
import { getContactsByPlayerId } from '../../libs/stores/contacts-store'
import { players } from '../../libs/stores/players-store'
import { scrollTop, toast } from '../../libs/utils/utils'
import BsCard from '../card/card'
import BsContactsEditor from '../contacts-editor/contacts-editor'
import BsEmptyPlayerFallback from '../empty-player-fallback/empty-player-fallback'
import BsInput from '../input/input'
import BsPhotoUpload from '../photo-upload/photo-upload'
import BsPlayer from '../player/player'

interface PlayerAddFormProps {
  canAddPlayer: Accessor<boolean>
  contacts: ContactRawData[]
  currentPlayer: Accessor<Player | null>
  isEditingNewPlayer: Accessor<boolean>
  onAddContact: (contact: ContactRawData) => void
  onCancel: () => void
  onPhotoChange: (hasPhoto: boolean, blob?: Blob) => void
  onPlayerChange: (data: PlayerRawData) => void
  onRemoveContact: (id: string) => void
  onSave: () => void
  onSubmit: (event: KeyboardEvent) => void
  onUpdateContact: (contact: ContactRawData) => void
}

function makePlayerFieldChangeHandler(
  props: PlayerAddFormProps,
  field: 'email' | 'firstName' | 'jerseyNumber' | 'lastName' | 'licenseNumber' | 'nicName' | 'phone'
) {
  return (value: string) => {
    props.onPlayerChange({ [field]: value })
  }
}

function AddPlayerButtons(props: { onAddPlayer: () => void; onTrombiClick: () => void }) {
  return (
    <div class="w-full">
      <hr />
      <div class="footer-buttons-container">
        <button class="btn btn-primary" onClick={props.onAddPlayer} type="button">
          <UserPlus />
          Ajouter un joueur
        </button>
        <button class="btn btn-secondary" onClick={props.onTrombiClick} type="button">
          <LayoutGrid />
          Trombinoscope
        </button>
      </div>
    </div>
  )
}

function PlayerAddForm(props: PlayerAddFormProps) {
  const onLastNameChange = makePlayerFieldChangeHandler(props, 'lastName')
  const onFirstNameChange = makePlayerFieldChangeHandler(props, 'firstName')
  const onJerseyNumberChange = makePlayerFieldChangeHandler(props, 'jerseyNumber')
  const onNicNameChange = makePlayerFieldChangeHandler(props, 'nicName')
  const onLicenseNumberChange = makePlayerFieldChangeHandler(props, 'licenseNumber')
  const onPhoneChange = makePlayerFieldChangeHandler(props, 'phone')
  const onEmailChange = makePlayerFieldChangeHandler(props, 'email')

  return (
    <BsCard
      body={
        <>
          {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: form-level Enter submission is a legacy behavior preserved during audit fixes */}
          <form class="flex flex-col gap-2" onKeyDown={props.onSubmit}>
            <Show when={props.currentPlayer()?.id}>
              <BsPhotoUpload
                hasPhoto={props.currentPlayer()?.hasPhoto ?? false}
                onChange={props.onPhotoChange}
                playerId={props.currentPlayer()?.id ?? ''}
              />
            </Show>
            <BsInput
              label="Nom"
              onChange={onLastNameChange}
              placeholder="Dupont"
              type="text"
              value={props.currentPlayer()?.lastName}
            />
            <BsInput
              label="Prénom"
              onChange={onFirstNameChange}
              placeholder="Charlie"
              type="text"
              value={props.currentPlayer()?.firstName}
            />
            <BsInput
              label="Numéro de maillot"
              onChange={onJerseyNumberChange}
              placeholder="01"
              type="text"
              value={props.currentPlayer()?.jerseyNumber}
            />
            <BsInput
              label="Surnom"
              onChange={onNicNameChange}
              placeholder="The B"
              type="text"
              value={props.currentPlayer()?.nicName}
            />
            <BsInput
              label="Numéro de licence"
              maxLength={LICENSE_NUMBER_MAX_LENGTH}
              onChange={onLicenseNumberChange}
              placeholder="AB123456789"
              type="text"
              value={props.currentPlayer()?.licenseNumber}
            />
            <BsInput
              label="Téléphone"
              onChange={onPhoneChange}
              placeholder="06 12 34 56 78"
              type="text"
              value={props.currentPlayer()?.phone}
            />
            <BsInput
              label="Email"
              onChange={onEmailChange}
              placeholder="joueur@example.com"
              type="email"
              value={props.currentPlayer()?.email}
            />
          </form>
          <Show when={props.currentPlayer()?.id}>
            <BsContactsEditor
              contacts={props.contacts}
              onAdd={props.onAddContact}
              onRemove={props.onRemoveContact}
              onUpdate={props.onUpdateContact}
            />
          </Show>
        </>
      }
      footer={
        <div class="footer-buttons-container">
          <button class="btn btn-primary btn-wide" onClick={props.onCancel} type="button">
            <X />
            Annuler
          </button>

          <button
            class="btn btn-primary btn-wide"
            disabled={!props.canAddPlayer()}
            onClick={props.onSave}
            type="button"
          >
            {props.isEditingNewPlayer() ? <UserPlus /> : <Save />}
            {props.isEditingNewPlayer() ? 'Ajouter' : 'Enregistrer'}
          </button>
        </div>
      }
      info="Les nom, prénom et numéro de maillot sont obligatoires"
      title={
        <p class="flex flex-row gap-1">
          <ContactIcon />
          {props.isEditingNewPlayer() ? 'Nouveau joueur' : 'Édition du joueur'}
        </p>
      }
    />
  )
}

export default function BsPlayers() {
  const navigate = useNavigate()

  const [isEditingNewPlayer, setIsEditingNewPlayer] = createSignal(false)
  const [isAddingPlayer, setIsAddingPlayer] = createSignal(false)
  const [canAddPlayer, setCanAddPlayer] = createSignal(false)
  const [currentPlayer, setCurrentPlayer] = createSignal<Player | null>(null)
  const [pendingPhotoBlob, setPendingPhotoBlob] = createSignal<Blob | undefined>(undefined)
  const [pendingPhotoDelete, setPendingPhotoDelete] = createSignal(false)

  /**
   * Transient draft of the player's contacts, owned by this form instance. Both
   * the new-player form and the edit-mode form stage their contacts here instead
   * of mutating any persisted store, so cancel discards them. It is seeded from
   * the contacts store on edit start and left empty for a new player.
   */
  const [pendingContacts, setPendingContacts] = createStore<ContactRawData[]>([])

  const playerLength = createMemo(() => players.length)
  const visiblePlayers = createMemo(() => players.map((raw) => new Player(raw)))

  function setNewPlayerData(data: PlayerRawData) {
    const player = currentPlayer()
    if (player) {
      player.update(data)
    } else {
      setCurrentPlayer(new Player(data))
    }

    setCanAddPlayer(currentPlayer()?.isRegisterable ?? false)
  }

  /**
   * The new-player draft is a single logical unit: the player being edited, its
   * staged contacts, the pending photo blob, and the photo-delete flag. resetDraft
   * clears all of them in one place so every entry/exit path (start, cancel,
   * register, edit) shares a single reset instead of duplicating it.
   */
  function resetDraft() {
    setCurrentPlayer(null)
    setPendingContacts([])
    setPendingPhotoBlob(undefined)
    setPendingPhotoDelete(false)
    setCanAddPlayer(false)
  }

  function startAddingNewPlayer() {
    setIsEditingNewPlayer(true)
    resetDraft()
    setCurrentPlayer(new Player())
    setIsAddingPlayer(true)
    scrollTop()
  }

  function onPhotoChange(_hasPhoto: boolean, blob?: Blob) {
    if (blob) {
      setPendingPhotoBlob(blob)
      setPendingPhotoDelete(false)
    } else {
      setPendingPhotoBlob(undefined)
      setPendingPhotoDelete(true)
    }
  }

  function cancelAddingPlayer() {
    setIsAddingPlayer(false)
    resetDraft()
  }

  function savePlayer() {
    registerPlayer().catch(() => toast("Erreur lors de l'enregistrement du joueur.", 'error'))
  }

  function editPlayerFromTile(player: Player) {
    editPlayer(player)
    scrollTop()
  }

  function addStagedContact(contact: ContactRawData) {
    const playerId = currentPlayer()?.id
    setPendingContacts((prev) => [...prev, { ...contact, playerId: playerId ?? contact.playerId }])
  }

  function updateStagedContact(contact: ContactRawData) {
    const index = pendingContacts.findIndex((candidate) => candidate.id === contact.id)
    if (index === -1) {
      return
    }
    const playerId = currentPlayer()?.id
    setPendingContacts(index, { ...contact, playerId: playerId ?? contact.playerId })
  }

  function removeStagedContact(id: string) {
    setPendingContacts((prev) => prev.filter((contact) => contact.id !== id))
  }

  async function registerPlayer() {
    const playerToRegister = currentPlayer()
    if (!playerToRegister?.isRegisterable) {
      return
    }

    const blob = pendingPhotoBlob()
    const isDelete = pendingPhotoDelete()
    // Snapshot the staged draft before any await: the commit inside the
    // orchestrator uses exactly these raws, never a re-read of the live draft.
    const draftContacts = pendingContacts.map((contact) => ({ ...contact }))

    if (isEditingNewPlayer()) {
      await orchestrator.registerNewPlayerWithContacts(playerToRegister, draftContacts, blob)
    } else {
      await orchestrator.updatePlayerWithPhotoAndContacts(playerToRegister, draftContacts, blob, isDelete)
    }

    setIsAddingPlayer(false)
    resetDraft()
  }

  function editPlayer(player: Player) {
    setIsEditingNewPlayer(false)
    resetDraft()
    const draftPlayer = new Player(player.getRawData())
    setCurrentPlayer(draftPlayer)
    setCanAddPlayer(draftPlayer.isRegisterable)
    setPendingContacts(getContactsByPlayerId(player.id))
    setIsAddingPlayer(true)
  }

  function onSubmit(event: KeyboardEvent) {
    if (event.key !== 'Enter') {
      return
    }

    savePlayer()
  }

  const goToTrombi = () => {
    navigate(ROUTE_TROMBI)
  }

  return (
    <div>
      <Show when={!isAddingPlayer()}>
        <Show fallback={<BsEmptyPlayerFallback />} when={(playerLength() || 0) > 0}>
          <div class="flex w-full flex-wrap justify-around gap-4">
            <For each={visiblePlayers()}>
              {(player) => (
                <div class="mx-auto w-fit md:mx-0">
                  <BsPlayer onEdit={editPlayerFromTile} player={player} />
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
      <Show
        fallback={<AddPlayerButtons onAddPlayer={startAddingNewPlayer} onTrombiClick={goToTrombi} />}
        when={isAddingPlayer()}
      >
        <PlayerAddForm
          canAddPlayer={canAddPlayer}
          contacts={pendingContacts}
          currentPlayer={currentPlayer}
          isEditingNewPlayer={isEditingNewPlayer}
          onAddContact={addStagedContact}
          onCancel={cancelAddingPlayer}
          onPhotoChange={onPhotoChange}
          onPlayerChange={setNewPlayerData}
          onRemoveContact={removeStagedContact}
          onSave={savePlayer}
          onSubmit={onSubmit}
          onUpdateContact={updateStagedContact}
        />
      </Show>
    </div>
  )
}
