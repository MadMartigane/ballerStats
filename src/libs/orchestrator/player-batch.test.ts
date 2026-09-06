import { beforeEach, describe, expect, it, vi } from 'vitest'
import Contact from '../contact/contact'
import Contacts from '../contacts/contacts'
import { deletePhotoAndFlag, setPhotoAndFlag } from '../photo-store/photo-store'
import Player from '../player/player'
import {
  applyPhoto,
  replacePlayerContactsSilent,
  validateContactReplacementBatch,
  validateNewPlayerBatch,
} from './player-batch'

vi.mock('../photo-store/photo-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../photo-store/photo-store')>()
  return {
    ...actual,
    deletePhotoAndFlag: vi.fn(),
    setPhotoAndFlag: vi.fn(),
  }
})

const NOT_REGISTERABLE_PATTERN = /not registerable/
const ALREADY_EXISTS_PATTERN = /already exists/
const DOES_NOT_BELONG_PATTERN = /doesn't belong to player/
const DUPLICATE_CONTACT_PATTERN = /Duplicate contact id/

function makePlayer(overrides: Partial<ConstructorParameters<typeof Player>[0]> = {}): Player {
  return new Player({ firstName: 'A', id: 'p1', jerseyNumber: '10', lastName: 'B', ...overrides })
}

function makeContact(playerId: string, id: string): Contact {
  return new Contact({ id, playerId, relationship: 'mother' })
}

describe('validateNewPlayerBatch', () => {
  it('accepts a valid player with matching, non-duplicate contacts', () => {
    expect(() =>
      validateNewPlayerBatch([], [], makePlayer(), [makeContact('p1', 'c1'), makeContact('p1', 'c2')])
    ).not.toThrow()
  })

  it('throws when the player is not registerable', () => {
    expect(() => validateNewPlayerBatch([], [], new Player(), [])).toThrow(NOT_REGISTERABLE_PATTERN)
  })

  it('throws when the player id already exists', () => {
    expect(() => validateNewPlayerBatch([makePlayer()], [], makePlayer(), [])).toThrow(ALREADY_EXISTS_PATTERN)
  })

  it('throws when a contact belongs to another player', () => {
    expect(() => validateNewPlayerBatch([], [], makePlayer(), [makeContact('p2', 'c1')])).toThrow(
      DOES_NOT_BELONG_PATTERN
    )
  })

  it('throws on duplicate contact ids inside the batch', () => {
    expect(() =>
      validateNewPlayerBatch([], [], makePlayer(), [makeContact('p1', 'c1'), makeContact('p1', 'c1')])
    ).toThrow(DUPLICATE_CONTACT_PATTERN)
  })

  it('throws when a contact id already exists in the collection', () => {
    expect(() =>
      validateNewPlayerBatch([], [makeContact('p1', 'c1')], makePlayer(), [makeContact('p1', 'c1')])
    ).toThrow(ALREADY_EXISTS_PATTERN)
  })
})

describe('validateContactReplacementBatch', () => {
  it('allows reusing the player own existing contact id', () => {
    expect(() =>
      validateContactReplacementBatch([makeContact('p1', 'c1')], makePlayer(), [makeContact('p1', 'c1')])
    ).not.toThrow()
  })

  it('throws when reusing a contact id owned by another player', () => {
    expect(() =>
      validateContactReplacementBatch([makeContact('p2', 'c2')], makePlayer(), [makeContact('p1', 'c2')])
    ).toThrow(ALREADY_EXISTS_PATTERN)
  })
})

describe('applyPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is a no-op with a keep change', async () => {
    await applyPhoto(makePlayer(), { kind: 'keep' })

    expect(setPhotoAndFlag).not.toHaveBeenCalled()
    expect(deletePhotoAndFlag).not.toHaveBeenCalled()
  })

  it('stores the photo when the change is set', async () => {
    const player = makePlayer()
    const blob = new Blob(['data'], { type: 'image/webp' })

    await applyPhoto(player, { blob, kind: 'set' })

    expect(setPhotoAndFlag).toHaveBeenCalledWith(player, blob)
    expect(deletePhotoAndFlag).not.toHaveBeenCalled()
  })

  it('deletes the photo when the change is delete', async () => {
    const player = makePlayer({ hasPhoto: true })

    await applyPhoto(player, { kind: 'delete' })

    expect(deletePhotoAndFlag).toHaveBeenCalledWith(player)
    expect(setPhotoAndFlag).not.toHaveBeenCalled()
  })
})

describe('replacePlayerContactsSilent', () => {
  it('replaces only the target player slice and preserves other players contacts', () => {
    const contacts = new Contacts([makeContact('p1', 'c1'), makeContact('p2', 'c2')])

    replacePlayerContactsSilent(contacts, 'p1', [makeContact('p1', 'c1a'), makeContact('p1', 'c1b')])

    expect(contacts.getByPlayerId('p1').map((contact) => contact.id)).toEqual(['c1a', 'c1b'])
    expect(contacts.getByPlayerId('p2').map((contact) => contact.id)).toEqual(['c2'])
  })
})
