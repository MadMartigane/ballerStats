import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContactRawData } from '../contact/contact.d'
import { deletePhotoAndFlag, setPhotoAndFlag } from '../photo-store/photo-store'
import Player from '../player/player'
import type { PlayerRawData } from '../player/player.d'
import { storeContacts, storePlayers } from '../store/store'
import { getContactsByPlayerId, getRawContacts, hydrateContacts, replacePlayerContacts } from '../stores/contacts-store'
import { getPlayerById, getRawPlayers, hydratePlayers } from '../stores/players-store'
import orchestrator from './orchestrator'
import { validateContactReplacementBatch } from './player-batch'

/**
 * Characterization suite for the register/update player + contacts + photo
 * path. Locks the CURRENT observable behavior (single persist per collection
 * after the full atomic commit, photo I/O first, validation before any commit)
 * so the refonte cannot silently change it.
 *
 * Basics kept from the pre-refonte version:
 * - The default `orchestrator` instance (constructed once at module import) is
 *   reused; the reactive players/contacts stores are module singletons, so
 *   every test resets them with `hydrate([])` (which by design never persists).
 * - Seeding uses `hydrate` on the stores, which never dispatches or persists.
 * - Persistence writes are mocked, no real I/O.
 *
 * Adapted mechanism spies (players/contacts no longer use the event bus):
 * - "exactly one CHANGE event + one persist" became "exactly one persist per
 *   collection", plus the final state being observable in full after the await.
 * - The class commit marker for the in-memory step became the persist call
 *   order (photo I/O must complete before the commit that persists).
 * - `draftContacts` are now raw arrays (the `Contacts` draft class is gone).
 * - The standalone silent replace helper became the store's
 *   `replacePlayerContacts` (same swap semantics, one persist).
 * - The last test's persistence coupling went from "one CHANGE event maps to
 *   one persist" to "hydrate never persists at all".
 */
vi.mock('../photo-store/photo-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../photo-store/photo-store')>()
  return {
    ...actual,
    deletePhotoAndFlag: vi.fn((player: Player) => {
      player.hasPhoto = false
    }),
    setPhotoAndFlag: vi.fn((player: Player, _blob: Blob) => {
      player.hasPhoto = true
    }),
  }
})

vi.mock('../store/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/store')>()
  return {
    ...actual,
    storeContacts: vi.fn(() => Promise.resolve()),
    storePlayers: vi.fn(() => Promise.resolve()),
  }
})

const DOES_NOT_BELONG_TO_PLAYER_PATTERN = /doesn't belong to player/
const DUPLICATE_CONTACT_ID_PATTERN = /Duplicate contact id/
const ALREADY_EXISTS_PATTERN = /already exists/
const PLAYER_DOES_NOT_EXIST_PATTERN = /doesn't exist/

function makePlayerData(overrides: Partial<PlayerRawData> = {}): PlayerRawData {
  return { firstName: 'Jean', id: 'p-default', jerseyNumber: '10', lastName: 'Dupont', ...overrides }
}

function makeContactData(overrides: Partial<ContactRawData> = {}): ContactRawData {
  return { id: 'c-default', playerId: 'p-default', relationship: 'mother', ...overrides }
}

function seedPlayer(data: PlayerRawData): void {
  hydratePlayers([...getRawPlayers(), { ...data }])
}

function seedContact(data: ContactRawData): void {
  hydrateContacts([...getRawContacts(), { ...data }])
}

beforeEach(() => {
  vi.clearAllMocks()
  hydratePlayers([])
  hydrateContacts([])
})

describe('registerNewPlayerWithContacts (characterization)', () => {
  it('commits player + contacts atomically: exactly one persist per collection, full final state', async () => {
    const player = new Player(makePlayerData({ id: 'p-reg-1' }))
    const contacts = [
      makeContactData({ id: 'c-reg-1', playerId: 'p-reg-1' }),
      makeContactData({ id: 'c-reg-2', playerId: 'p-reg-1', relationship: 'father' }),
    ]

    await orchestrator.registerNewPlayerWithContacts(player, contacts)

    expect(storePlayers).toHaveBeenCalledTimes(1)
    expect(storeContacts).toHaveBeenCalledTimes(1)

    // A single persist already contains the full final state: no intermediate
    // prefix (player without its contacts) ever reached the store.
    const persistedPlayers = vi.mocked(storePlayers).mock.calls.at(-1)?.[0]
    expect(persistedPlayers?.some((raw) => raw.id === 'p-reg-1')).toBe(true)
    const persistedContacts = vi.mocked(storeContacts).mock.calls.at(-1)?.[0]
    expect(persistedContacts?.some((raw) => raw.id === 'c-reg-1')).toBe(true)
    expect(persistedContacts?.some((raw) => raw.id === 'c-reg-2')).toBe(true)

    // The reactive stores expose the whole batch together (Solid batch commit).
    expect(getPlayerById('p-reg-1')?.firstName).toBe('Jean')
    expect(getContactsByPlayerId('p-reg-1').map((raw) => raw.id)).toEqual(['c-reg-1', 'c-reg-2'])
  })

  it('rejects invalid contacts (foreign playerId, intra-batch or stored duplicate id) without committing anything', async () => {
    const foreignPlayer = new Player(makePlayerData({ id: 'p-reg-2a' }))
    await expect(
      orchestrator.registerNewPlayerWithContacts(foreignPlayer, [
        makeContactData({ id: 'c-reg-2a', playerId: 'someone-else' }),
      ])
    ).rejects.toThrow(DOES_NOT_BELONG_TO_PLAYER_PATTERN)

    const dupBatchPlayer = new Player(makePlayerData({ id: 'p-reg-2b' }))
    await expect(
      orchestrator.registerNewPlayerWithContacts(dupBatchPlayer, [
        makeContactData({ id: 'c-reg-2b', playerId: 'p-reg-2b' }),
        makeContactData({ id: 'c-reg-2b', playerId: 'p-reg-2b', relationship: 'father' }),
      ])
    ).rejects.toThrow(DUPLICATE_CONTACT_ID_PATTERN)

    seedPlayer(makePlayerData({ id: 'p-reg-2c' }))
    seedContact(makeContactData({ id: 'c-reg-2c', playerId: 'p-reg-2c' }))
    const newPlayer = new Player(makePlayerData({ id: 'p-reg-2d' }))
    await expect(
      orchestrator.registerNewPlayerWithContacts(newPlayer, [makeContactData({ id: 'c-reg-2c', playerId: 'p-reg-2d' })])
    ).rejects.toThrow(ALREADY_EXISTS_PATTERN)

    expect(storePlayers).not.toHaveBeenCalled()
    expect(storeContacts).not.toHaveBeenCalled()
    expect(getRawPlayers().some((raw) => raw.id === 'p-reg-2b')).toBe(false)
    expect(getRawPlayers().some((raw) => raw.id === 'p-reg-2d')).toBe(false)
  })

  it('applies the photo (setPhotoAndFlag) before any in-memory commit and persists hasPhoto:true', async () => {
    const player = new Player(makePlayerData({ id: 'p-reg-3' }))
    const photo = new Blob(['fake-webp'], { type: 'image/webp' })
    const contacts = [makeContactData({ id: 'c-reg-3', playerId: 'p-reg-3' })]

    await orchestrator.registerNewPlayerWithContacts(player, contacts, photo)

    expect(setPhotoAndFlag).toHaveBeenCalledWith(player, photo)
    // Photo I/O runs first; the commit (and its single persist) only follows.
    expect(vi.mocked(setPhotoAndFlag).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(storePlayers).mock.invocationCallOrder[0]
    )

    const persistedPlayers = vi.mocked(storePlayers).mock.calls.at(-1)?.[0]
    expect(persistedPlayers?.find((raw) => raw.id === 'p-reg-3')?.hasPhoto).toBe(true)
  })

  it('rolls back cleanly when photo I/O fails: throw, nothing committed, flag untouched', async () => {
    vi.mocked(setPhotoAndFlag).mockRejectedValueOnce(new Error('photo storage failed'))
    const player = new Player(makePlayerData({ id: 'p-reg-4' }))
    const contacts = [makeContactData({ id: 'c-reg-4', playerId: 'p-reg-4' })]

    await expect(
      orchestrator.registerNewPlayerWithContacts(player, contacts, new Blob(['x'], { type: 'image/webp' }))
    ).rejects.toThrow('photo storage failed')

    expect(player.hasPhoto).toBe(false)
    expect(getRawPlayers().some((raw) => raw.id === 'p-reg-4')).toBe(false)
    expect(getRawContacts().some((raw) => raw.id === 'c-reg-4')).toBe(false)
    expect(storePlayers).not.toHaveBeenCalled()
    expect(storeContacts).not.toHaveBeenCalled()
  })
})

describe('updatePlayerWithPhotoAndContacts (characterization)', () => {
  it('replaces the player contacts wholesale, keeps other players contacts intact and drops removed ones', async () => {
    seedPlayer(makePlayerData({ id: 'p-upd-5' }))
    seedContact(makeContactData({ firstName: 'Marie', id: 'c-upd-5a', playerId: 'p-upd-5' }))
    seedContact(makeContactData({ firstName: 'Paul', id: 'c-upd-5b', playerId: 'p-upd-5', relationship: 'father' }))
    seedPlayer(makePlayerData({ id: 'p-upd-5-other' }))
    seedContact(makeContactData({ firstName: 'Autre', id: 'c-upd-5-other', playerId: 'p-upd-5-other' }))

    const draftContacts = [
      makeContactData({ firstName: 'Marie Updated', id: 'c-upd-5a', playerId: 'p-upd-5' }),
      makeContactData({ id: 'c-upd-5c', playerId: 'p-upd-5', relationship: 'other' }),
    ]

    const updatedPlayer = new Player(
      makePlayerData({ firstName: 'Jean-Marc', id: 'p-upd-5', jerseyNumber: '10', lastName: 'Dupont' })
    )

    await orchestrator.updatePlayerWithPhotoAndContacts(updatedPlayer, draftContacts)

    const playerContacts = getContactsByPlayerId('p-upd-5')
    expect(playerContacts.map((contact) => contact.id)).toEqual(['c-upd-5a', 'c-upd-5c'])
    expect(playerContacts.find((contact) => contact.id === 'c-upd-5a')?.firstName).toBe('Marie Updated')
    expect(getRawContacts().some((contact) => contact.id === 'c-upd-5b')).toBe(false)

    const otherContact = getRawContacts().find((contact) => contact.id === 'c-upd-5-other')
    expect(otherContact?.playerId).toBe('p-upd-5-other')
    expect(otherContact?.firstName).toBe('Autre')
    expect(getPlayerById('p-upd-5')?.firstName).toBe('Jean-Marc')

    expect(storePlayers).toHaveBeenCalledTimes(1)
    expect(storeContacts).toHaveBeenCalledTimes(1)

    const persistedContacts = vi.mocked(storeContacts).mock.calls.at(-1)?.[0]
    expect(persistedContacts?.some((raw) => raw.id === 'c-upd-5b')).toBe(false)
    expect(persistedContacts?.some((raw) => raw.id === 'c-upd-5-other')).toBe(true)
  })

  it('rejects for a ghost player id without persisting anything', async () => {
    const ghost = new Player(makePlayerData({ id: 'p-ghost-6' }))

    await expect(orchestrator.updatePlayerWithPhotoAndContacts(ghost, [])).rejects.toThrow(
      PLAYER_DOES_NOT_EXIST_PATTERN
    )

    expect(storePlayers).not.toHaveBeenCalled()
    expect(storeContacts).not.toHaveBeenCalled()
  })

  it('deletes the photo via deletePhotoAndFlag and persists hasPhoto:false', async () => {
    seedPlayer(makePlayerData({ hasPhoto: true, id: 'p-upd-7' }))
    seedContact(makeContactData({ id: 'c-upd-7', playerId: 'p-upd-7' }))

    const playerWithPhoto = new Player(makePlayerData({ hasPhoto: true, id: 'p-upd-7' }))
    const draftContacts = [makeContactData({ id: 'c-upd-7', playerId: 'p-upd-7' })]

    await orchestrator.updatePlayerWithPhotoAndContacts(playerWithPhoto, draftContacts, undefined, true)

    expect(deletePhotoAndFlag).toHaveBeenCalledWith(playerWithPhoto)
    const persistedPlayers = vi.mocked(storePlayers).mock.calls.at(-1)?.[0]
    expect(persistedPlayers?.find((raw) => raw.id === 'p-upd-7')?.hasPhoto).toBe(false)
  })
})

describe('validateContactReplacementBatch (characterization)', () => {
  it('allows reusing a contact id of the SAME player but rejects a contact id of ANOTHER player', () => {
    const playerRaw = makePlayerData({ id: 'p-val-8' })
    const allContacts = [
      makeContactData({ id: 'c-val-8a', playerId: 'p-val-8' }),
      makeContactData({ id: 'c-val-8b', playerId: 'p-val-8', relationship: 'father' }),
      makeContactData({ id: 'c-val-8-other', playerId: 'p-val-8-other' }),
    ]

    const reusingOwnId = [
      makeContactData({ firstName: 'Updated', id: 'c-val-8a', playerId: 'p-val-8' }),
      makeContactData({ id: 'c-val-8c', playerId: 'p-val-8' }),
    ]
    expect(() => validateContactReplacementBatch(allContacts, playerRaw, reusingOwnId)).not.toThrow()

    const stealingOtherId = [makeContactData({ id: 'c-val-8-other', playerId: 'p-val-8' })]
    expect(() => validateContactReplacementBatch(allContacts, playerRaw, stealingOtherId)).toThrow(
      ALREADY_EXISTS_PATTERN
    )
  })
})

describe('replacePlayerContacts (characterization)', () => {
  it('swaps only the target player contacts and persists exactly once', () => {
    hydrateContacts([
      makeContactData({ id: 'c-rep-9a', playerId: 'p-rep-9' }),
      makeContactData({ id: 'c-rep-9-other', playerId: 'p-rep-9-other' }),
    ])

    replacePlayerContacts('p-rep-9', [
      makeContactData({ firstName: 'Updated', id: 'c-rep-9a', playerId: 'p-rep-9' }),
      makeContactData({ id: 'c-rep-9b', playerId: 'p-rep-9' }),
    ])

    expect(getRawContacts().map((contact) => contact.id)).toEqual(['c-rep-9-other', 'c-rep-9a', 'c-rep-9b'])
    expect(getRawContacts().find((contact) => contact.id === 'c-rep-9a')?.firstName).toBe('Updated')
    expect(storeContacts).toHaveBeenCalledTimes(1)
  })
})

describe('store hydrate (characterization)', () => {
  it('hydrate loads the stores and never persists from the store itself', () => {
    hydratePlayers([makePlayerData({ id: 'p-hydra-10' })])
    hydrateContacts([makeContactData({ id: 'c-hydra-10', playerId: 'p-hydra-10' })])

    expect(getRawPlayers().some((raw) => raw.id === 'p-hydra-10')).toBe(true)
    expect(getRawContacts().some((raw) => raw.id === 'c-hydra-10')).toBe(true)
    expect(storePlayers).not.toHaveBeenCalled()
    expect(storeContacts).not.toHaveBeenCalled()
  })
})
