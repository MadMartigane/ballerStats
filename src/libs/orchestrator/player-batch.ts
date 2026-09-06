import type Contact from '../contact/contact'
import type Contacts from '../contacts/contacts'
import { assertContactAddable } from '../contacts/contacts'
import { deletePhotoAndFlag, setPhotoAndFlag } from '../photo-store/photo-store'
import type Player from '../player/player'
import { assertPlayerAddable } from '../players/players'

/**
 * Pure, side-effect-free validation for a batch of contacts that must all
 * belong to the given player. Merges the contacts-belong-to-player check, the
 * intra-batch duplicate-id check, and the contacts-addable check against the
 * provided collection into a single pass. The addable check is delegated to
 * the canonical `assertContactAddable` helper; only the belong-to-player and
 * intra-batch duplicate checks are local to the batch.
 */
export function validateContactBatch(
  contacts: Contact[],
  player: Player,
  addableCollection: Contact[],
  context: string
): void {
  const contactIds = new Set<string>()
  for (const contact of contacts) {
    if (contact.playerId !== player.id) {
      throw new Error(`[${context}] The contact id ${contact.id} doesn't belong to player ${player.id}.`)
    }
    if (contactIds.has(contact.id)) {
      throw new Error(`[${context}] Duplicate contact id ${contact.id} in batch.`)
    }
    contactIds.add(contact.id)
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
  existingPlayers: Player[],
  existingContacts: Contact[],
  player: Player,
  contacts: Contact[]
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
  allContacts: Contact[],
  player: Player,
  draftContacts: Contact[]
): void {
  const otherContacts = allContacts.filter((contact) => contact.playerId !== player.id)
  validateContactBatch(draftContacts, player, otherContacts, 'Orchestrator.updatePlayerWithPhotoAndContacts()')
}

/**
 * Discriminated union describing the photo change requested at the policy-owner
 * boundary. `set` writes a new blob, `delete` removes the photo, `keep` leaves
 * the photo untouched. Encoding the intent explicitly removes the implicit
 * precedence rule of the previous `(photo?, deletePhotoFlag)` pair, which could
 * express contradictory states.
 */
export type PhotoChange = { kind: 'set'; blob: Blob } | { kind: 'delete' } | { kind: 'keep' }

/**
 * Best-effort photo write/delete for a player, invoked AFTER the in-memory
 * batch commit so a photo I/O failure can never abort the committed batch.
 * Dispatches on the change kind: `set` writes the blob and sets `hasPhoto`,
 * `delete` removes the photo and clears `hasPhoto`, `keep` is a no-op.
 */
export async function applyPhoto(player: Player, change: PhotoChange): Promise<void> {
  if (change.kind === 'set') {
    await setPhotoAndFlag(player, change.blob)
  } else if (change.kind === 'delete') {
    await deletePhotoAndFlag(player)
  }
}

/**
 * Atomically replace an existing player's contacts with the draft's, using
 * only silent variants so the caller controls when the single CONTACTS::CHANGE
 * is fired. The new collection is built first (other players' contacts plus
 * the draft's) and swapped in via a single assignment, so no partial state can
 * be observed even if a draft contact were invalid.
 */
export function replacePlayerContactsSilent(contacts: Contacts, playerId: string, draftContacts: Contact[]): void {
  const otherContacts = contacts.contacts.filter((contact) => contact.playerId !== playerId)
  contacts.setFromRawDataSilent([
    ...otherContacts.map((contact) => contact.getRawData()),
    ...draftContacts.map((contact) => contact.getRawData()),
  ])
}
