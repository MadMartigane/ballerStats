import { beforeEach, describe, expect, it, vi } from 'vitest'
import Contact from '../contact/contact'
import bsEventBus from '../event-bus/event-bus'
import Match from '../match/match'
import type { MatchStatLogEntry } from '../match/match.d'
import { Orchestrator } from '../orchestrator/orchestrator'
import Player from '../player/player'
import Team from '../team/team'

/**
 * `rewriteIdentities` is the legacy-id fixup applied after PocketBase creates a
 * record: the server id replaces the local numeric-string id and every foreign
 * key referencing it is rewritten in one pass.
 */
describe('Orchestrator.rewriteIdentities', () => {
  it('rewrites player ids and every dependent foreign key', () => {
    const orchestrator = new Orchestrator()
    const stats: MatchStatLogEntry[] = [
      { name: '2pts', playerId: '1', timestamp: 1, type: 'success', value: 1 },
      { name: 'assist', playerId: null, timestamp: 2, type: 'secondary', value: 2 },
    ]
    orchestrator.replaceDataset({
      contacts: [new Contact({ id: '4', playerId: '1', relationship: 'mother' })],
      matchs: [
        new Match({
          id: '3',
          playersInTheFive: ['1'],
          stats,
          teamId: '2',
        }),
      ],
      players: [new Player({ firstName: 'A', id: '1', lastName: 'B' })],
      teams: [new Team({ id: '2', name: 'T', playerIds: ['1'] })],
    })

    orchestrator.rewriteIdentities({ players: { '1': 'aaaa11111111111' } })

    expect(orchestrator.Players.getRawData()[0]?.id).toBe('aaaa11111111111')
    expect(orchestrator.Teams.getRawData()[0]?.playerIds).toEqual(['aaaa11111111111'])
    expect(orchestrator.Matchs.getRawData()[0]?.teamId).toBe('2')
    expect(orchestrator.Matchs.getRawData()[0]?.playersInTheFive).toEqual(['aaaa11111111111'])
    expect(orchestrator.Matchs.getRawData()[0]?.stats).toEqual([
      { name: '2pts', playerId: 'aaaa11111111111', timestamp: 1, type: 'success', value: 1 },
      { name: 'assist', playerId: null, timestamp: 2, type: 'secondary', value: 2 },
    ])
    expect(orchestrator.Contacts.getRawData()[0]?.playerId).toBe('aaaa11111111111')
  })

  it('rewrites team ids and the match team relation together', () => {
    const orchestrator = new Orchestrator()
    orchestrator.replaceDataset({
      contacts: [],
      matchs: [new Match({ id: '3', teamId: 'legacy-team' })],
      players: [],
      teams: [new Team({ id: 'legacy-team', name: 'T', playerIds: [] })],
    })

    orchestrator.rewriteIdentities({ teams: { 'legacy-team': 'bbbb11111111112' } })

    expect(orchestrator.Teams.getRawData()[0]?.id).toBe('bbbb11111111112')
    expect(orchestrator.Matchs.getRawData()[0]?.teamId).toBe('bbbb11111111112')
  })

  it('does not bump updatedAt during re-keying', () => {
    const orchestrator = new Orchestrator()
    orchestrator.replaceDataset({
      contacts: [],
      matchs: [],
      players: [new Player({ id: '1', updatedAt: 42 })],
      teams: [],
    })

    orchestrator.rewriteIdentities({ players: { '1': 'cccc11111111113' } })

    expect(orchestrator.Players.getRawData()[0]).toMatchObject({ id: 'cccc11111111113', updatedAt: 42 })
  })

  it('dispatches the players change event for a players-only rewrite', () => {
    const orchestrator = new Orchestrator()
    orchestrator.replaceDataset({
      contacts: [],
      matchs: [],
      players: [new Player({ id: '1', updatedAt: 42 })],
      teams: [],
    })
    const listener = vi.fn()
    bsEventBus.addEventListener('BS::PLAYERS::CHANGE', listener)

    orchestrator.rewriteIdentities({ players: { '1': 'cccc11111111113' } })
    bsEventBus.removeEventListener('BS::PLAYERS::CHANGE', listener)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(orchestrator.Players.getRawData()[0]?.id).toBe('cccc11111111113')
  })
})

describe('Orchestrator.overwriteById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('replaces a record by id regardless of LWW (server authoritative)', () => {
    const orchestrator = new Orchestrator()
    orchestrator.replaceDataset({
      contacts: [],
      matchs: [
        new Match({
          id: '3',
          opponent: 'Local Opp',
          stats: [{ name: '2pts', playerId: null, timestamp: 1, type: 'success', value: 2 }],
          updatedAt: 900,
        }),
        new Match({ id: '4', opponent: 'Untouched', updatedAt: 1 }),
      ],
      players: [],
      teams: [],
    })

    orchestrator.overwriteById({
      matchs: [
        new Match({
          id: '3',
          opponent: 'Server Opp',
          stats: [{ name: '3pts', playerId: null, timestamp: 7, type: 'success', value: 3 }],
          updatedAt: 200,
        }),
      ],
    })

    // The server copy wins even though the local updatedAt was higher.
    expect(orchestrator.Matchs.getRawData()).toEqual([
      expect.objectContaining({ id: '3', opponent: 'Server Opp', updatedAt: 200 }),
      expect.objectContaining({ id: '4', opponent: 'Untouched' }),
    ])
  })
})
