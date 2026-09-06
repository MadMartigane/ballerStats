import type { ContactRawData } from '../contact/contact.d'
import { deletePhotoAndFlag, setPhotoAndFlag } from '../photo-store/photo-store'
import type Player from '../player/player'
import type { PlayerRawData } from '../player/player.d'
import { assertContactAddable } from '../stores/contacts-store'
import { assertPlayerAddable } from '../stores/players-store'

/**
 * Pure, side-effect-free validation for a batch of contacts that must all
 * belong to the given player. Merges the contacts-belong-to-player check, the
 * intra-batch duplicate-id check, and the contacts-addable check against the
 * provided collection into a single pass. The addable check is delegated to
 * the canonical `assertContactAddable` helper; only the belong-to-player and
 * intra-batch duplicate checks are local to the batch.
 */
export function validateContactBatch(
  contacts: ContactRawData[],
  player: PlayerRawData,
  addableCollection: ContactRawData[],
  context: string
): void {
  const contactIds = new Set<string>()
  for (const contact of contacts) {
    if (contact.playerId !== player.id) {
      throw new Error(`[${context}] The contact id ${contact.id} doesn't belong to player ${player.id}.`)
    }
    if (contact.id !== undefined) {
      if (contactIds.has(contact.id)) {
        throw new Error(`[${context}] Duplicate contact id ${contact.id} in batch.`)
      }
      contactIds.add(contact.id)
    }
    assertContactAddable(addableCollection, contact)
  }
}

/**
 * Pure, side-effect-free validation for registering a brand-new player with its
 * contacts. Runs entirely synchronously with no I/O so the caller can commit
 * in-memory immediately after, with no await window in between. Merges the
 * player registerability + unique-id checks, the contacts-belong-to-player
 * check, the intra-batch duplicate-id check, and the contacts-addable check
 * against the existing collection into a single pass. The player checks are
 * delegated to the canonical `assertPlayerAddable` helper and the contacts
 * checks to `assertContactAddable`; only the belong-to-player and intra-batch
 * duplicate checks are local to the batch.
 */
export function validateNewPlayerBatch(
  existingPlayers: PlayerRawData[],
  existingContacts: ContactRawData[],
  player: PlayerRawData,
  contacts: ContactRawData[]
): void {
  assertPlayerAddable(existingPlayers, player)
  validateContactBatch(contacts, player, existingContacts, 'Orchestrator.registerNewPlayerWithContacts()')
}

/**
 * Pure, side-effect-free validation for replacing an existing player's contacts
 * with a draft batch. The player's current contacts are excluded from the
 * addable check because they are replaced wholesale by the draft, so a draft
 * contact reusing one of the player's own contact ids is not a duplicate.
 */
export function validateContactReplacementBatch(
  allContacts: ContactRawData[],
  player: PlayerRawData,
  draftContacts: ContactRawData[]
): void {
  const otherContacts = allContacts.filter((contact) => contact.playerId !== player.id)
  validateContactBatch(draftContacts, player, otherContacts, 'Orchestrator.updatePlayerWithPhotoAndContacts()')
}

/**
 * Apply the optional photo I/O for a player. Runs the fallible photo write or
 * delete first and mutates the player's `hasPhoto` flag to match, so the
 * caller can commit the player data (with the final flag) right after.
 */
export async function applyPhoto(player: Player, photo?: Blob, deletePhotoFlag = false): Promise<void> {
  if (photo) {
    await setPhotoAndFlag(player, photo)
  } else if (deletePhotoFlag && player.hasPhoto) {
    await deletePhotoAndFlag(player)
  }
}
