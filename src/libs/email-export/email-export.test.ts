import { describe, expect, it } from 'vitest'
import Contact from '../contact/contact'
import Player from '../player/player'
import Team from '../team/team'
import { collectTeamEmails, slugifyTeamName } from './email-export'

describe('slugifyTeamName', () => {
  it('returns an empty string for null', () => {
    expect(slugifyTeamName(null)).toBe('')
  })

  it('returns an empty string for an empty string', () => {
    expect(slugifyTeamName('')).toBe('')
  })

  it('returns an empty string for undefined', () => {
    expect(slugifyTeamName(undefined)).toBe('')
  })

  it('returns an empty string for whitespace-only input', () => {
    expect(slugifyTeamName('   ')).toBe('')
  })

  it('slugifies names with accents and special characters', () => {
    expect(slugifyTeamName('Équipe A')).toBe('equipe-a')
    expect(slugifyTeamName('Les Champions 2024!')).toBe('les-champions-2024')
    expect(slugifyTeamName('Hélène & François')).toBe('helene-francois')
  })
})

describe('collectTeamEmails', () => {
  it('collects player email and contact emails in playerIds order', () => {
    const team = new Team({ id: 't1', name: 'My Team', playerIds: ['p1', 'p2'] })
    const players = [
      new Player({ email: 'p1@example.com', id: 'p1' }),
      new Player({ email: 'p2@example.com', id: 'p2' }),
    ]
    const contacts = [
      new Contact({ email: 'mom.p1@example.com', id: 'c1', playerId: 'p1', relationship: 'mother' }),
      new Contact({ email: 'dad.p2@example.com', id: 'c2', playerId: 'p2', relationship: 'father' }),
    ]

    expect(collectTeamEmails(team, players, contacts)).toEqual([
      'p1@example.com',
      'mom.p1@example.com',
      'p2@example.com',
      'dad.p2@example.com',
    ])
  })

  it('deduplicates identical emails', () => {
    const team = new Team({ id: 't1', name: 'Team', playerIds: ['p1', 'p2'] })
    const players = [
      new Player({ email: 'shared@example.com', id: 'p1' }),
      new Player({ email: 'shared@example.com', id: 'p2' }),
    ]

    expect(collectTeamEmails(team, players, [])).toEqual(['shared@example.com'])
  })

  it('filters empty and whitespace-only emails', () => {
    const team = new Team({ id: 't1', name: 'Team', playerIds: ['p1', 'p2'] })
    const players = [new Player({ email: '  ', id: 'p1' }), new Player({ email: 'valid@example.com', id: 'p2' })]
    const contacts = [new Contact({ email: '', id: 'c1', playerId: 'p2', relationship: 'other' })]

    expect(collectTeamEmails(team, players, contacts)).toEqual(['valid@example.com'])
  })

  it('returns an empty array for a team with no players', () => {
    const team = new Team({ id: 't1', name: 'Team', playerIds: [] })

    expect(collectTeamEmails(team, [], [])).toEqual([])
  })

  it('returns an empty array for players with no emails', () => {
    const team = new Team({ id: 't1', name: 'Team', playerIds: ['p1', 'p2'] })
    const players = [new Player({ id: 'p1' }), new Player({ id: 'p2' })]

    expect(collectTeamEmails(team, players, [])).toEqual([])
  })
})
