import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markCollectionDirty } from '../nostromo/dirty-marks'
import type { PlayerRawData } from '../player/player.d'
import { addPlayer, getRawPlayers, hydratePlayers, removePlayer } from './players-store'

/**
 * The players store had no suite of its own: this one covers the single thing
 * it owes the sync layer, the dirty mark of its persist funnel. The mark itself
 * (debounce, outbox, status) is tested in
 * `src/libs/nostromo/push-engine.test.ts`, and the batch paths that go through
 * the orchestrator are covered by `src/libs/orchestrator/player-batch.test.ts`.
 */
vi.mock('../store/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/store')>()
  return {
    ...actual,
    storePlayers: vi.fn(() => Promise.resolve()),
  }
})

vi.mock('../nostromo/dirty-marks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../nostromo/dirty-marks')>()
  return {
    ...actual,
    markCollectionDirty: vi.fn(),
  }
})

/** A registerable raw: first name + last name + jersey number is the minimum score. */
function makePlayerData(overrides: Partial<PlayerRawData> = {}): PlayerRawData {
  return {
    firstName: 'Nina',
    id: 'p1',
    jerseyNumber: '10',
    lastName: 'Dupont',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  hydratePlayers([])
})

describe('players-store dirty marks', () => {
  it('marks the players unit dirty on a mutation, and never on a hydrate', () => {
    hydratePlayers([makePlayerData()])
    expect(markCollectionDirty).not.toHaveBeenCalled()

    addPlayer(makePlayerData({ id: 'p2' }))
    expect(markCollectionDirty).toHaveBeenCalledTimes(1)
    expect(markCollectionDirty).toHaveBeenCalledWith('players')

    removePlayer('p2')
    expect(markCollectionDirty).toHaveBeenCalledTimes(2)
    expect(markCollectionDirty).toHaveBeenCalledWith('players')
    expect(getRawPlayers().map((raw) => raw.id)).toEqual(['p1'])
  })
})
