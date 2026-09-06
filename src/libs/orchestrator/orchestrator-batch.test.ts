import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Contact from '../contact/contact'
import type { ContactRawData } from '../contact/contact.d'
import bsEventBus from '../event-bus/event-bus'
import { deletePhoto, deletePhotoAndFlag, setPhotoAndFlag } from '../photo-store/photo-store'
import Player from '../player/player'
import type { PlayerRawData } from '../player/player.d'
import { STORAGE_CONTACTS_KEY, STORAGE_PLAYERS_KEY } from '../store/store'
import { toast } from '../utils/utils'
import { Orchestrator } from './orchestrator'
import type { DomainDataset } from './orchestrator.d'

vi.mock('../utils/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/utils')>()
  return {
    ...actual,
    toast: vi.fn(),
  }
})

vi.mock('../photo-store/photo-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../photo-store/photo-store')>()
  return {
    ...actual,
    deletePhoto: vi.fn(),
    deletePhotoAndFlag: vi.fn(),
    setPhotoAndFlag: vi.fn(),
  }
})

const PHOTO_FAILURE_TOAST = "Le joueur a été enregistré mais sa photo n'a pas pu être sauvegardée."
const PHOTO_DELETE_FAILURE_TOAST = "Le joueur a été enregistré mais sa photo n'a pas pu être supprimée."
const ALREADY_EXISTS_PATTERN = /already exists/
const DOES_NOT_EXIST_PATTERN = /doesn't exist/

const orchestrator = new Orchestrator()
const playersListener = vi.fn()
const contactsListener = vi.fn()

bsEventBus.addEventListener('BS::PLAYERS::CHANGE', playersListener)
bsEventBus.addEventListener('BS::CONTACTS::CHANGE', contactsListener)

function makePlayer(overrides: Partial<PlayerRawData> = {}): Player {
  return new Player({ firstName: 'A', id: 'p1', jerseyNumber: '10', lastName: 'B', ...overrides })
}

function makeContact(playerId: string, id: string, overrides: Partial<ContactRawData> = {}): Contact {
  return new Contact({ id, playerId, relationship: 'mother', ...overrides })
}

function storedPlayers(): PlayerRawData[] {
  return JSON.parse(localStorage.getItem(STORAGE_PLAYERS_KEY) ?? 'null')?.data ?? []
}

function storedContacts(): ContactRawData[] {
  return JSON.parse(localStorage.getItem(STORAGE_CONTACTS_KEY) ?? 'null')?.data ?? []
}

function seedDataset(dataset: DomainDataset) {
  orchestrator.replaceDataset(dataset)
  // replaceDataset fires bus events while seeding; wipe the spurious listener calls.
  vi.clearAllMocks()
}

beforeEach(() => {
  seedDataset({ contacts: [], matchs: [], players: [], teams: [] })
  localStorage.clear()
  vi.mocked(setPhotoAndFlag).mockImplementation((player) => {
    player.hasPhoto = true
    return Promise.resolve()
  })
  vi.mocked(deletePhotoAndFlag).mockImplementation((player) => {
    player.hasPhoto = false
    return Promise.resolve()
  })
  vi.mocked(deletePhoto).mockImplementation(() => Promise.resolve())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Orchestrator.registerNewPlayerWithContacts', () => {
  it('registers the player and its contacts and fires exactly one event per collection', async () => {
    const player = makePlayer()
    const contacts = [makeContact('p1', 'c1'), makeContact('p1', 'c2')]
    const blob = new Blob(['photo'], { type: 'image/webp' })

    await orchestrator.registerNewPlayerWithContacts(player, contacts, { blob, kind: 'set' })

    expect(orchestrator.getPlayer('p1')).not.toBeNull()
    expect(orchestrator.Contacts.getByPlayerId('p1')).toHaveLength(2)
    expect(playersListener).toHaveBeenCalledTimes(1)
    expect(contactsListener).toHaveBeenCalledTimes(1)
    expect(setPhotoAndFlag).toHaveBeenCalledWith(player, blob)
    expect(orchestrator.getPlayer('p1')?.hasPhoto).toBe(true)
    expect(storedPlayers()).toHaveLength(1)
    expect(storedContacts()).toHaveLength(2)
  })

  it('commits nothing when validation fails', async () => {
    seedDataset({ contacts: [], matchs: [], players: [makePlayer()], teams: [] })

    await expect(
      orchestrator.registerNewPlayerWithContacts(makePlayer(), [makeContact('p1', 'c1')], { kind: 'keep' })
    ).rejects.toThrow(ALREADY_EXISTS_PATTERN)

    expect(orchestrator.Players.length).toBe(1)
    expect(orchestrator.Contacts.length).toBe(0)
    expect(setPhotoAndFlag).not.toHaveBeenCalled()
    expect(playersListener).not.toHaveBeenCalled()
    expect(contactsListener).not.toHaveBeenCalled()
  })

  it('commits the batch without the photo when photo storage fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(setPhotoAndFlag).mockRejectedValueOnce(new Error('idb down'))
    const blob = new Blob(['photo'], { type: 'image/webp' })

    await expect(
      orchestrator.registerNewPlayerWithContacts(makePlayer(), [makeContact('p1', 'c1')], { blob, kind: 'set' })
    ).resolves.toBeUndefined()

    expect(orchestrator.getPlayer('p1')).not.toBeNull()
    expect(orchestrator.getPlayer('p1')?.hasPhoto).toBe(false)
    expect(toast).toHaveBeenCalledWith(PHOTO_FAILURE_TOAST, 'error')
    expect(playersListener).toHaveBeenCalledTimes(1)
    expect(contactsListener).toHaveBeenCalledTimes(1)
    expect(storedPlayers()).toHaveLength(1)
  })

  it('skips photo I/O entirely when no photo is passed', async () => {
    await expect(
      orchestrator.registerNewPlayerWithContacts(makePlayer(), [makeContact('p1', 'c1')], { kind: 'keep' })
    ).resolves.toBeUndefined()

    expect(setPhotoAndFlag).not.toHaveBeenCalled()
    expect(orchestrator.getPlayer('p1')).not.toBeNull()
  })

  it('is not corrupted by a concurrent mutation during photo I/O', async () => {
    vi.mocked(setPhotoAndFlag).mockImplementation((player) => {
      orchestrator.Players.add(makePlayer({ id: 'p2' }))
      player.hasPhoto = true
      return Promise.resolve()
    })
    const blob = new Blob(['photo'], { type: 'image/webp' })

    await expect(
      orchestrator.registerNewPlayerWithContacts(makePlayer(), [makeContact('p1', 'c1')], { blob, kind: 'set' })
    ).resolves.toBeUndefined()

    expect(orchestrator.Players.length).toBe(2)
    expect(orchestrator.getPlayer('p1')?.hasPhoto).toBe(true)
  })
})

describe('Orchestrator.updatePlayerWithPhotoAndContacts', () => {
  it('updates the player and replaces their contacts, preserving other players contacts', async () => {
    seedDataset({
      contacts: [makeContact('p1', 'c1'), makeContact('p2', 'c2')],
      matchs: [],
      players: [makePlayer(), makePlayer({ id: 'p2' })],
      teams: [],
    })

    const updatedP1 = makePlayer({ firstName: 'Updated' })
    const c1Updated = makeContact('p1', 'c1', { phone: '123' })
    const c1b = makeContact('p1', 'c1b', { relationship: 'father' })

    await orchestrator.updatePlayerWithPhotoAndContacts(updatedP1, [c1Updated, c1b], { kind: 'keep' })

    expect(orchestrator.getPlayer('p1')?.firstName).toBe('Updated')
    const p1Contacts = orchestrator.Contacts.getByPlayerId('p1')
    expect(p1Contacts).toHaveLength(2)
    expect(p1Contacts.some((contact) => contact.phone === '123')).toBe(true)
    expect(orchestrator.Contacts.getByPlayerId('p2').map((contact) => contact.id)).toEqual(['c2'])
    expect(playersListener).toHaveBeenCalledTimes(1)
    expect(contactsListener).toHaveBeenCalledTimes(1)
    expect(storedPlayers().find((player) => player.id === 'p1')?.firstName).toBe('Updated')
  })

  it('reuses the player own contact ids without duplicate errors', async () => {
    seedDataset({
      contacts: [makeContact('p1', 'c1')],
      matchs: [],
      players: [makePlayer()],
      teams: [],
    })

    await expect(
      orchestrator.updatePlayerWithPhotoAndContacts(makePlayer(), [makeContact('p1', 'c1', { phone: '999' })], {
        kind: 'keep',
      })
    ).resolves.toBeUndefined()

    expect(orchestrator.Contacts.getByPlayerId('p1')).toHaveLength(1)
  })

  it('throws and changes nothing for an unknown player id', async () => {
    await expect(
      orchestrator.updatePlayerWithPhotoAndContacts(makePlayer({ id: 'ghost' }), [], { kind: 'keep' })
    ).rejects.toThrow(DOES_NOT_EXIST_PATTERN)

    expect(orchestrator.Players.length).toBe(0)
    expect(orchestrator.Contacts.length).toBe(0)
    expect(setPhotoAndFlag).not.toHaveBeenCalled()
  })

  it('throws and changes nothing for a draft contact duplicating another player contact id', async () => {
    seedDataset({
      contacts: [makeContact('p1', 'c1'), makeContact('p2', 'c2')],
      matchs: [],
      players: [makePlayer(), makePlayer({ id: 'p2' })],
      teams: [],
    })

    const duplicate = makeContact('p1', 'c2')

    await expect(
      orchestrator.updatePlayerWithPhotoAndContacts(makePlayer(), [duplicate], { kind: 'keep' })
    ).rejects.toThrow(ALREADY_EXISTS_PATTERN)

    expect(orchestrator.Contacts.getByPlayerId('p2').map((contact) => contact.id)).toEqual(['c2'])
    expect(orchestrator.Contacts.getByPlayerId('p1').map((contact) => contact.id)).toEqual(['c1'])
    expect(orchestrator.getPlayer('p1')?.firstName).toBe('A')
  })

  it('applies the delete-photo flag and clears hasPhoto', async () => {
    seedDataset({
      contacts: [],
      matchs: [],
      players: [makePlayer({ hasPhoto: true })],
      teams: [],
    })

    await orchestrator.updatePlayerWithPhotoAndContacts(makePlayer({ hasPhoto: true }), [], { kind: 'delete' })

    expect(deletePhotoAndFlag).toHaveBeenCalled()
    expect(orchestrator.getPlayer('p1')?.hasPhoto).toBe(false)
  })

  it('keeps the previous photo state when photo storage fails on update', async () => {
    seedDataset({
      contacts: [makeContact('p1', 'c1')],
      matchs: [],
      players: [makePlayer({ hasPhoto: true })],
      teams: [],
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(setPhotoAndFlag).mockRejectedValueOnce(new Error('idb down'))
    const blob = new Blob(['photo'], { type: 'image/webp' })

    await expect(
      orchestrator.updatePlayerWithPhotoAndContacts(
        makePlayer({ firstName: 'Updated', hasPhoto: true }),
        [makeContact('p1', 'c1')],
        { blob, kind: 'set' }
      )
    ).resolves.toBeUndefined()

    expect(orchestrator.getPlayer('p1')?.firstName).toBe('Updated')
    expect(orchestrator.getPlayer('p1')?.hasPhoto).toBe(true)
    expect(toast).toHaveBeenCalledWith(PHOTO_FAILURE_TOAST, 'error')
    expect(playersListener).toHaveBeenCalledTimes(1)
    expect(contactsListener).toHaveBeenCalledTimes(1)
  })

  it('keeps the previous photo state when photo deletion fails on update', async () => {
    seedDataset({
      contacts: [],
      matchs: [],
      players: [makePlayer({ hasPhoto: true })],
      teams: [],
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(deletePhotoAndFlag).mockRejectedValueOnce(new Error('idb down'))

    await expect(
      orchestrator.updatePlayerWithPhotoAndContacts(makePlayer({ hasPhoto: true }), [], { kind: 'delete' })
    ).resolves.toBeUndefined()

    expect(orchestrator.getPlayer('p1')?.hasPhoto).toBe(true)
    expect(toast).toHaveBeenCalledWith(PHOTO_DELETE_FAILURE_TOAST, 'error')
    expect(playersListener).toHaveBeenCalledTimes(1)
    expect(contactsListener).toHaveBeenCalledTimes(1)
  })

  it('is not corrupted by a concurrent removal during photo I/O', async () => {
    seedDataset({
      contacts: [makeContact('p1', 'c1'), makeContact('p2', 'c2')],
      matchs: [],
      players: [makePlayer(), makePlayer({ id: 'p2' })],
      teams: [],
    })
    vi.mocked(setPhotoAndFlag).mockImplementation((player) => {
      orchestrator.Players.removeSilent(player)
      player.hasPhoto = true
      return Promise.resolve()
    })
    const blob = new Blob(['photo'], { type: 'image/webp' })

    await expect(
      orchestrator.updatePlayerWithPhotoAndContacts(makePlayer({ firstName: 'Updated' }), [makeContact('p1', 'c1')], {
        blob,
        kind: 'set',
      })
    ).resolves.toBeUndefined()

    expect(orchestrator.getPlayer('p1')).toBeNull()
    expect(orchestrator.getPlayer('p2')).not.toBeNull()
    expect(orchestrator.getPlayer('p2')?.firstName).toBe('A')
    expect(orchestrator.getPlayer('p2')?.hasPhoto).toBe(false)
    expect(orchestrator.Contacts.getByPlayerId('p2').map((contact) => contact.id)).toEqual(['c2'])
    expect(playersListener).toHaveBeenCalledTimes(1)
    expect(contactsListener).toHaveBeenCalledTimes(1)
    // The player was removed concurrently during the I/O window, so the
    // just-written blob is undone via a best-effort delete.
    expect(deletePhoto).toHaveBeenCalledWith('p1')
  })
})
