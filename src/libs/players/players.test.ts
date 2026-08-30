import { describe, expect, it } from 'vitest'
import bsEventBus from '../event-bus/event-bus'
import Player from '../player/player'
import Players from './players'

function registeredPlayer(id: string): Player {
  return new Player({ firstName: 'Mock', id, jerseyNumber: '0', lastName: 'Player' })
}

describe('Players — soft delete', () => {
  it('remove() hides the record from the live list and length', () => {
    const players = new Players()
    const player = registeredPlayer('p1')
    players.add(player)

    players.remove(player)

    expect(players.players).toEqual([])
    expect(players.length).toBe(0)
  })

  it('keeps the tombstone in getRawData() (persistence and export)', () => {
    const players = new Players()
    const player = registeredPlayer('p1')
    players.add(player)

    players.remove(player)

    const raw = players.getRawData()
    expect(raw).toHaveLength(1)
    expect(raw[0].id).toBe('p1')
    expect(raw[0].deletedAt).not.toBeNull()
  })

  it('keeps live records visible alongside tombstones', () => {
    const players = new Players()
    const live = registeredPlayer('p1')
    const removed = registeredPlayer('p2')
    players.add(live)
    players.add(removed)

    players.remove(removed)

    expect(players.length).toBe(1)
    expect(players.players.map((p) => p.id)).toEqual(['p1'])
    expect(players.getRawData()).toHaveLength(2)
  })

  it('remove() fires a change event', () => {
    const players = new Players()
    const player = registeredPlayer('p1')
    players.add(player)

    let fired = false
    const handler = () => {
      fired = true
    }
    bsEventBus.addEventListener('BS::PLAYERS::CHANGE', handler)
    players.remove(player)
    bsEventBus.removeEventListener('BS::PLAYERS::CHANGE', handler)

    expect(fired).toBe(true)
  })

  it('updatePlayer() stamps updatedAt and persists fields on the stored player', () => {
    const players = new Players()
    const player = registeredPlayer('p1')
    players.add(player)
    expect(player.updatedAt).toBe(0)

    const edited = new Player({ firstName: 'Mock', hasPhoto: true, id: 'p1', jerseyNumber: '0', lastName: 'Player' })
    players.updatePlayer(edited)

    expect(player.hasPhoto).toBe(true)
    expect(player.updatedAt).toBeGreaterThan(0)
  })

  it('clear() hard-wipes without tombstones', () => {
    const players = new Players()
    players.add(registeredPlayer('p1'))
    players.add(registeredPlayer('p2'))

    players.clear()

    expect(players.length).toBe(0)
    expect(players.getRawData()).toEqual([])
  })
})
