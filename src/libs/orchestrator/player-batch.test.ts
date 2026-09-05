import { beforeEach, describe, expect, it, vi } from 'vitest'
import Contact from '../contact/contact'
import type { ContactRawData } from '../contact/contact.d'
import Contacts from '../contacts/contacts'
import bsEventBus from '../event-bus/event-bus'
import { deletePhotoAndFlag, setPhotoAndFlag } from '../photo-store/photo-store'
import Player from '../player/player'
import type { PlayerRawData } from '../player/player.d'
import Players from '../players/players'
import { storeContacts, storePlayers } from '../store/store'
import orchestrator from './orchestrator'
import { replacePlayerContactsSilent, validateContactReplacementBatch } from './player-batch'

/**
 * Characterization suite for the register/update player + contacts + photo
 * path. Locks the CURRENT observable behavior (single CHANGE event and single
 * persist per collection after the full atomic commit, photo I/O first,
 * validation before any commit) so the upcoming state-management refonte
 * cannot silently change it.
 *
 * The default `orchestrator` instance (constructed once at module import) is
 * reused: it is the only bus subscriber, so every CHANGE dispatch maps to
 * exactly one persist call. Seeding uses the public silent variants
 * (`orchestrator.Players.addSilent`, `orchestrator.Contacts.addSilent`) which
 * never dispatch or persist. Persistence writes are mocked, no real I/O.
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

const dispatchEventSpy = vi.spyOn(bsEventBus, 'dispatchEvent')

const DOES_NOT_BELONG_TO_PLAYER_PATTERN = /doesn't belong to player/
const DUPLICATE_CONTACT_ID_PATTERN = /Duplicate contact id/
const ALREADY_EXISTS_PATTERN = /already exists/
const PLAYER_DOES_NOT_EXIST_PATTERN = /doesn't exist/

function dispatchCount(eventType: string): number {
  return dispatchEventSpy.mock.calls.filter(([type]) => type === eventType).length
}

function makePlayerData(overrides: Partial<PlayerRawData> = {}): PlayerRawData {
  return { firstName: 'Jean', id: 'p-default', jerseyNumber: '10', lastName: 'Dupont', ...overrides }
}

function makeContactData(overrides: Partial<ContactRawData> = {}): ContactRawData {
  return { id: 'c-default', playerId: 'p-default', relationship: 'mother', ...overrides }
}

function seedPlayer(data: PlayerRawData): void {
  orchestrator.Players.addSilent(new Player(data))
}

function seedContact(data: ContactRawData): void {
  orchestrator.Contacts.addSilent(new Contact(data))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('registerNewPlayerWithContacts (characterization)', () => {
  it('commits player + contacts atomically: exactly one CHANGE event and one persist per collection', async () => {
    const player = new Player(makePlayerData({ id: 'p-reg-1' }))
    const contacts = [
      new Contact(makeContactData({ id: 'c-reg-1', playerId: 'p-reg-1' })),
      new Contact(makeContactData({ id: 'c-reg-2', playerId: 'p-reg-1', relationship: 'father' })),
    ]

    await orchestrator.registerNewPlayerWithContacts(player, contacts)

    expect(storePlayers).toHaveBeenCalledTimes(1)
    expect(storeContacts).toHaveBeenCalledTimes(1)
    expect(dispatchCount('BS::PLAYERS::CHANGE')).toBe(1)
    expect(dispatchCount('BS::CONTACTS::CHANGE')).toBe(1)

    // The single persist already contains the full final state: no intermediate
    // prefix (player without its contacts) ever reached the store.
    const persistedPlayers = vi.mocked(storePlayers).mock.calls.at(-1)?.[0]
    expect(persistedPlayers?.some((raw) => raw.id === 'p-reg-1')).toBe(true)
    const persistedContacts = vi.mocked(storeContacts).mock.calls.at(-1)?.[0]
    expect(persistedContacts?.some((raw) => raw.id === 'c-reg-1')).toBe(true)
    expect(persistedContacts?.some((raw) => raw.id === 'c-reg-2')).toBe(true)
  })

  it('rejects invalid contacts (foreign playerId, intra-batch or stored duplicate id) without committing anything', async () => {
    const foreignPlayer = new Player(makePlayerData({ id: 'p-reg-2a' }))
    await expect(
      orchestrator.registerNewPlayerWithContacts(foreignPlayer, [
        new Contact(makeContactData({ id: 'c-reg-2a', playerId: 'someone-else' })),
      ])
    ).rejects.toThrow(DOES_NOT_BELONG_TO_PLAYER_PATTERN)

    const dupBatchPlayer = new Player(makePlayerData({ id: 'p-reg-2b' }))
    await expect(
      orchestrator.registerNewPlayerWithContacts(dupBatchPlayer, [
        new Contact(makeContactData({ id: 'c-reg-2b', playerId: 'p-reg-2b' })),
        new Contact(makeContactData({ id: 'c-reg-2b', playerId: 'p-reg-2b', relationship: 'father' })),
      ])
    ).rejects.toThrow(DUPLICATE_CONTACT_ID_PATTERN)

    seedPlayer(makePlayerData({ id: 'p-reg-2c' }))
    seedContact(makeContactData({ id: 'c-reg-2c', playerId: 'p-reg-2c' }))
    const newPlayer = new Player(makePlayerData({ id: 'p-reg-2d' }))
    await expect(
      orchestrator.registerNewPlayerWithContacts(newPlayer, [
        new Contact(makeContactData({ id: 'c-reg-2c', playerId: 'p-reg-2d' })),
      ])
    ).rejects.toThrow(ALREADY_EXISTS_PATTERN)

    expect(storePlayers).not.toHaveBeenCalled()
    expect(storeContacts).not.toHaveBeenCalled()
    expect(orchestrator.Players.players.some((raw) => raw.id === 'p-reg-2b')).toBe(false)
    expect(orchestrator.Players.players.some((raw) => raw.id === 'p-reg-2d')).toBe(false)
  })

  it('applies the photo (setPhotoAndFlag) before any in-memory commit and persists hasPhoto:true', async () => {
    const addSilentSpy = vi.spyOn(Players.prototype, 'addSilent')
    const player = new Player(makePlayerData({ id: 'p-reg-3' }))
    const photo = new Blob(['fake-webp'], { type: 'image/webp' })
    const contacts = [new Contact(makeContactData({ id: 'c-reg-3', playerId: 'p-reg-3' }))]

    await orchestrator.registerNewPlayerWithContacts(player, contacts, photo)

    expect(setPhotoAndFlag).toHaveBeenCalledWith(player, photo)
    expect(vi.mocked(setPhotoAndFlag).mock.invocationCallOrder[0]).toBeLessThan(
      addSilentSpy.mock.invocationCallOrder[0]
    )

    const persistedPlayers = vi.mocked(storePlayers).mock.calls.at(-1)?.[0]
    expect(persistedPlayers?.find((raw) => raw.id === 'p-reg-3')?.hasPhoto).toBe(true)
  })

  it('rolls back cleanly when photo I/O fails: throw, nothing committed, flag untouched', async () => {
    vi.mocked(setPhotoAndFlag).mockRejectedValueOnce(new Error('photo storage failed'))
    const player = new Player(makePlayerData({ id: 'p-reg-4' }))
    const contacts = [new Contact(makeContactData({ id: 'c-reg-4', playerId: 'p-reg-4' }))]

    await expect(
      orchestrator.registerNewPlayerWithContacts(player, contacts, new Blob(['x'], { type: 'image/webp' }))
    ).rejects.toThrow('photo storage failed')

    expect(player.hasPhoto).toBe(false)
    expect(orchestrator.Players.players.some((raw) => raw.id === 'p-reg-4')).toBe(false)
    expect(orchestrator.Contacts.contacts.some((raw) => raw.id === 'c-reg-4')).toBe(false)
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

    const draft = new Contacts()
    draft.setFromRawDataSilent([
      makeContactData({ firstName: 'Marie Updated', id: 'c-upd-5a', playerId: 'p-upd-5' }),
      makeContactData({ id: 'c-upd-5c', playerId: 'p-upd-5', relationship: 'other' }),
    ])

    const updatedPlayer = new Player(
      makePlayerData({ firstName: 'Jean-Marc', id: 'p-upd-5', jerseyNumber: '10', lastName: 'Dupont' })
    )

    await orchestrator.updatePlayerWithPhotoAndContacts(updatedPlayer, draft)

    const playerContacts = orchestrator.Contacts.getByPlayerId('p-upd-5')
    expect(playerContacts.map((contact) => contact.id)).toEqual(['c-upd-5a', 'c-upd-5c'])
    expect(playerContacts.find((contact) => contact.id === 'c-upd-5a')?.firstName).toBe('Marie Updated')
    expect(orchestrator.Contacts.contacts.some((contact) => contact.id === 'c-upd-5b')).toBe(false)

    const otherContact = orchestrator.Contacts.contacts.find((contact) => contact.id === 'c-upd-5-other')
    expect(otherContact?.playerId).toBe('p-upd-5-other')
    expect(otherContact?.firstName).toBe('Autre')
    expect(orchestrator.Players.getById('p-upd-5')?.firstName).toBe('Jean-Marc')

    expect(storePlayers).toHaveBeenCalledTimes(1)
    expect(storeContacts).toHaveBeenCalledTimes(1)
    expect(dispatchCount('BS::PLAYERS::CHANGE')).toBe(1)
    expect(dispatchCount('BS::CONTACTS::CHANGE')).toBe(1)

    const persistedContacts = vi.mocked(storeContacts).mock.calls.at(-1)?.[0]
    expect(persistedContacts?.some((raw) => raw.id === 'c-upd-5b')).toBe(false)
    expect(persistedContacts?.some((raw) => raw.id === 'c-upd-5-other')).toBe(true)
  })

  it('rejects for a ghost player id without persisting anything', async () => {
    const ghost = new Player(makePlayerData({ id: 'p-ghost-6' }))
    const draft = new Contacts()

    await expect(orchestrator.updatePlayerWithPhotoAndContacts(ghost, draft)).rejects.toThrow(
      PLAYER_DOES_NOT_EXIST_PATTERN
    )

    expect(storePlayers).not.toHaveBeenCalled()
    expect(storeContacts).not.toHaveBeenCalled()
  })

  it('deletes the photo via deletePhotoAndFlag and persists hasPhoto:false', async () => {
    seedPlayer(makePlayerData({ hasPhoto: true, id: 'p-upd-7' }))
    seedContact(makeContactData({ id: 'c-upd-7', playerId: 'p-upd-7' }))

    const playerWithPhoto = new Player(makePlayerData({ hasPhoto: true, id: 'p-upd-7' }))
    const draft = new Contacts()
    draft.setFromRawDataSilent([makeContactData({ id: 'c-upd-7', playerId: 'p-upd-7' })])

    await orchestrator.updatePlayerWithPhotoAndContacts(playerWithPhoto, draft, undefined, true)

    expect(deletePhotoAndFlag).toHaveBeenCalledWith(playerWithPhoto)
    const persistedPlayers = vi.mocked(storePlayers).mock.calls.at(-1)?.[0]
    expect(persistedPlayers?.find((raw) => raw.id === 'p-upd-7')?.hasPhoto).toBe(false)
  })
})

describe('validateContactReplacementBatch (characterization)', () => {
  it('allows reusing a contact id of the SAME player but rejects a contact id of ANOTHER player', () => {
    const player = new Player(makePlayerData({ id: 'p-val-8' }))
    const allContacts = [
      new Contact(makeContactData({ id: 'c-val-8a', playerId: 'p-val-8' })),
      new Contact(makeContactData({ id: 'c-val-8b', playerId: 'p-val-8', relationship: 'father' })),
      new Contact(makeContactData({ id: 'c-val-8-other', playerId: 'p-val-8-other' })),
    ]

    const reusingOwnId = new Contacts()
    reusingOwnId.setFromRawDataSilent([
      makeContactData({ firstName: 'Updated', id: 'c-val-8a', playerId: 'p-val-8' }),
      makeContactData({ id: 'c-val-8c', playerId: 'p-val-8' }),
    ])
    expect(() =>
      validateContactReplacementBatch(allContacts, player, reusingOwnId.getByPlayerId('p-val-8'))
    ).not.toThrow()

    const stealingOtherId = new Contacts()
    stealingOtherId.setFromRawDataSilent([makeContactData({ id: 'c-val-8-other', playerId: 'p-val-8' })])
    expect(() =>
      validateContactReplacementBatch(allContacts, player, stealingOtherId.getByPlayerId('p-val-8'))
    ).toThrow(ALREADY_EXISTS_PATTERN)
  })
})

describe('replacePlayerContactsSilent (characterization)', () => {
  it('swaps only the target player contacts and never fires a CHANGE event', () => {
    const collections = new Contacts()
    collections.setFromRawDataSilent([
      makeContactData({ id: 'c-rep-9a', playerId: 'p-rep-9' }),
      makeContactData({ id: 'c-rep-9-other', playerId: 'p-rep-9-other' }),
    ])

    const draft = new Contacts()
    draft.setFromRawDataSilent([
      makeContactData({ firstName: 'Updated', id: 'c-rep-9a', playerId: 'p-rep-9' }),
      makeContactData({ id: 'c-rep-9b', playerId: 'p-rep-9' }),
    ])

    replacePlayerContactsSilent(collections, 'p-rep-9', draft)

    expect(collections.contacts.map((contact) => contact.id)).toEqual(['c-rep-9-other', 'c-rep-9a', 'c-rep-9b'])
    expect(collections.contacts.find((contact) => contact.id === 'c-rep-9a')?.firstName).toBe('Updated')
    expect(dispatchCount('BS::CONTACTS::CHANGE')).toBe(0)
  })
})

describe('setFromRawData (characterization)', () => {
  it('hydrates the collection, fires a single CHANGE event, and never persists from the collection itself', () => {
    const players = new Players()
    const contacts = new Contacts()

    players.setFromRawData([makePlayerData({ id: 'p-hydra-10' })])
    contacts.setFromRawData([makeContactData({ id: 'c-hydra-10', playerId: 'p-hydra-10' })])

    // Persistence is strictly event-driven: one CHANGE event maps to exactly
    // one persist from the orchestrator's bus subscriber. The collections
    // themselves never call the store, so a direct persist inside a future
    // `hydrate` would break this 1:1 coupling.
    expect(dispatchCount('BS::PLAYERS::CHANGE')).toBe(1)
    expect(dispatchCount('BS::CONTACTS::CHANGE')).toBe(1)
    expect(storePlayers).toHaveBeenCalledTimes(1)
    expect(storeContacts).toHaveBeenCalledTimes(1)
  })
})
