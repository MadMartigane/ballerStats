import type Contact from '../../contact'
import type Match from '../../match'
import type Player from '../../player'
import type Team from '../../team'
import { makeContact } from '../factories/contact.factory'
import { makePlayer } from '../factories/player.factory'
import { makeTeam } from '../factories/team.factory'
import { makeFullGameMatch, makePartialMatch } from './full-game.scenario'

const DEMO_PLAYER_COUNT = 10
const DEMO_STARTER_COUNT = 5
const JERSEY_STEP = 4

export interface DemoDataset {
  contacts: Contact[]
  matchs: Match[]
  players: Player[]
  teams: Team[]
}

/** Deterministic, fully-overridden dataset for the DEV demo button. */
export function seedDemoDataset(): DemoDataset {
  // 10 players (stable IDs player-1..player-10)
  const players: Player[] = []
  for (let i = 1; i <= DEMO_PLAYER_COUNT; i++) {
    players.push(
      makePlayer({
        id: `player-${i}`,
        firstName: 'Prénom',
        lastName: `Joueur${i}`,
        jerseyNumber: String(i * JERSEY_STEP).padStart(2, '0'),
        nicName: i <= DEMO_STARTER_COUNT ? `Nick${i}` : undefined,
      })
    )
  }

  // 2 teams (Team A = starters player-1..player-5; Team B = bench player-6..player-10)
  const teamA = makeTeam({
    id: 'team-a',
    name: 'Les Aigles',
    playerIds: ['player-1', 'player-2', 'player-3', 'player-4', 'player-5'],
  })
  const teamB = makeTeam({
    id: 'team-b',
    name: 'Les Tigres',
    playerIds: ['player-6', 'player-7', 'player-8', 'player-9', 'player-10'],
  })

  // 3 matches: 2 full + 1 partial
  const match1 = makeFullGameMatch('team-a', ['player-1', 'player-2', 'player-3', 'player-4', 'player-5'], {
    opponent: 'Lions de Berlin',
    type: 'home',
  })
  const match2 = makeFullGameMatch('team-a', ['player-1', 'player-2', 'player-3', 'player-4', 'player-6'], {
    opponent: 'Panthers BC',
    type: 'outside',
  })
  const match3 = makePartialMatch('team-a', ['player-1', 'player-2', 'player-3', 'player-4', 'player-5'], {
    opponent: 'Sharks United',
  })

  // A couple of contacts tied to players
  const contact1 = makeContact({
    id: 'contact-1',
    playerId: 'player-1',
    firstName: 'Marie',
    lastName: 'Joueur1',
    relationship: 'mother',
    phone: '+33000000001',
  })
  const contact2 = makeContact({
    id: 'contact-2',
    playerId: 'player-2',
    firstName: 'Paul',
    lastName: 'Joueur2',
    relationship: 'father',
    phone: '+33000000002',
  })

  return {
    teams: [teamA, teamB],
    players,
    matchs: [match1, match2, match3],
    contacts: [contact1, contact2],
  }
}
