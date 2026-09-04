import Player from '../../player/player'
import type { PlayerRawData } from '../../player/player.d'
import { nextId } from '../mock-counter'

const ID_PREFIX = 'mock-player'

/**
 * Build a deterministic Player instance. Defaults satisfy isRegisterable
 * (firstName + lastName + jerseyNumber = score 30, see player.ts:52-62).
 */
export function makePlayer(overrides: Partial<PlayerRawData> = {}): Player {
  const raw: PlayerRawData = {
    firstName: 'Player',
    hasPhoto: false,
    jerseyNumber: '0',
    lastName: 'Mock',
    ...overrides,
    id: overrides.id ?? nextId(ID_PREFIX),
  }
  return new Player(raw)
}
