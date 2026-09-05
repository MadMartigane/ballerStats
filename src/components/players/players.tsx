import { useNavigate } from '@solidjs/router'
import { Contact as ContactIcon, LayoutGrid, Save, UserPlus, X } from 'lucide-solid'
import { createSignal, For, onCleanup, Show } from 'solid-js'
import Contacts from '../../libs/contacts/contacts'
import { createContactsSource } from '../../libs/contacts/contacts-source'
import bsEventBus from '../../libs/event-bus/event-bus'
import { ROUTE_TROMBI } from '../../libs/menu/routes'
import orchestrator from '../../libs/orchestrator/orchestrator'
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

export default function BsPlayers() {
  const navigate = useNavigate()

  const [isEditingNewPlayer, setIsEditingNewPlayer] = createSignal(false)
  const [isAddingPlayer, setIsAddingPlayer] = createSignal(false)
  const [canAddPlayer, setCanAddPlayer] = createSignal(false)
  const [playerLength, setPlayerLength] = createSignal(orchestrator.Players.length)
  const [currentPlayer, setCurrentPlayer] = createSignal<Player | null>(null)
  const [pendingPhotoBlob, setPendingPhotoBlob] = createSignal<Blob | undefined>(undefined)
  const [pendingPhotoDelete, setPendingPhotoDelete] = createSignal(false)

  /**
   * Transient draft of the player's contacts, owned by this form instance. Both
   * the new-player form and the edit-mode form stage their contacts here instead
   * of mutating the persisted orchestrator collection, so cancel discards them.
   * It is seeded from `getByPlayerId` on edit start and left empty for a new
   * player. The editor reads it through a single `ContactsSource` adapter whose
   * mutations are silent (no global `BS::CONTACTS::CHANGE`), so staging the
   * draft never triggers an orchestrator persist — the global event is fired
   * only by the orchestrator commit methods.
   */
  const pendingContacts = new Contacts()
  const pendingContactsSource = createContactsSource(pendingContacts, () => currentPlayer()?.id ?? '')

  const handlePlayersChange = () => {
    setPlayerLength(orchestrator.Players.length)
  }
  bsEventBus.addEventListener('BS::PLAYERS::CHANGE', handlePlayersChange)
  onCleanup(() => {
    bsEventBus.removeEventListener('BS::PLAYERS::CHANGE', handlePlayersChange)
  })

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
    pendingContacts.setFromRawDataSilent([])
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
    const playerToRegister = currentPlayer()
    if (!playerToRegister?.isRegisterable) {
      return
    }

    const blob = pendingPhotoBlob()
    const isDelete = pendingPhotoDelete()

    if (isEditingNewPlayer()) {
      await orchestrator.registerNewPlayerWithContacts(playerToRegister, pendingContacts.contacts, blob)
    } else {
      await orchestrator.updatePlayerWithPhotoAndContacts(playerToRegister, pendingContacts, blob, isDelete)
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
    pendingContacts.setFromRawDataSilent(
      orchestrator.Contacts.getByPlayerId(player.id).map((contact) => contact.getRawData())
    )
    setIsAddingPlayer(true)
  }

  function onSubmit(event: KeyboardEvent) {
    if (event.key !== 'Enter') {
      return
    }

    savePlayer()
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
            <Show when={currentPlayer()?.id}>
              <BsPhotoUpload
                hasPhoto={currentPlayer()?.hasPhoto ?? false}
                onChange={onPhotoChange}
                playerId={currentPlayer()?.id ?? ''}
              />
            </Show>
            {BsInput({
              label: 'Nom',
              onChange: (value: string) => {
                setNewPlayerData({ lastName: value })
              },
              placeholder: 'Dupont',
              type: 'text',
              value: currentPlayer()?.lastName,
            })}
            {BsInput({
              label: 'Prénom',
              onChange: (value: string) => {
                setNewPlayerData({ firstName: value })
              },
              placeholder: 'Charlie',
              type: 'text',
              value: currentPlayer()?.firstName,
            })}
            {BsInput({
              label: 'Numéro de maillot',
              onChange: (value: string) => {
                setNewPlayerData({ jerseyNumber: value })
              },
              placeholder: '01',
              type: 'text',
              value: currentPlayer()?.jerseyNumber,
            })}
            {BsInput({
              label: 'Surnom',
              onChange: (value: string) => {
                setNewPlayerData({ nicName: value })
              },
              placeholder: 'The B',
              type: 'text',
              value: currentPlayer()?.nicName,
            })}
            {BsInput({
              label: 'Numéro de licence',
              maxLength: LICENSE_NUMBER_MAX_LENGTH,
              onChange: (value: string) => {
                setNewPlayerData({ licenseNumber: value })
              },
              placeholder: 'AB123456789',
              type: 'text',
              value: currentPlayer()?.licenseNumber,
            })}
            {BsInput({
              label: 'Téléphone',
              onChange: (value: string) => {
                setNewPlayerData({ phone: value })
              },
              placeholder: '06 12 34 56 78',
              type: 'text',
              value: currentPlayer()?.phone,
            })}
            {BsInput({
              label: 'Email',
              onChange: (value: string) => {
                setNewPlayerData({ email: value })
              },
              placeholder: 'joueur@example.com',
              type: 'email',
              value: currentPlayer()?.email,
            })}
          </form>
          <Show when={currentPlayer()?.id}>
            {/* The Show condition above guarantees a non-null player with a truthy id when rendered. */}
            <BsContactsEditor source={pendingContactsSource} />
          </Show>
        </>
      ),
      footer: (
        <div class="footer-buttons-container">
          <button class="btn btn-primary btn-wide" onClick={cancelAddingPlayer} type="button">
            <X />
            Annuler
          </button>

          <button class="btn btn-primary btn-wide" disabled={!canAddPlayer()} onClick={savePlayer} type="button">
            {isEditingNewPlayer() ? <UserPlus /> : <Save />}
            {isEditingNewPlayer() ? 'Ajouter' : 'Enregistrer'}
          </button>
        </div>
      ),
      info: 'Les nom, prénom et numéro de maillot sont obligatoires',
      title: (
        <p class="flex flex-row gap-1">
          <ContactIcon />
          {isEditingNewPlayer() ? 'Nouveau joueur' : 'Édition du joueur'}
        </p>
      ),
    })
  }

  return (
    <div>
      <Show when={!isAddingPlayer()}>
        <Show fallback={<BsEmptyPlayerFallback />} when={(playerLength() || 0) > 0}>
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
      <Show fallback={renderAddPlayerButton(() => navigate(ROUTE_TROMBI))} when={isAddingPlayer()}>
        {renderAddingPlayerCard()}
      </Show>
    </div>
  )
}
