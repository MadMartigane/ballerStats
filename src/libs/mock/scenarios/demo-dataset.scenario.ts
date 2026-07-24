import type Contact from '../../contact'
import type Match from '../../match'
import type Player from '../../player'
import type Team from '../../team'
import { makeContact } from '../factories/contact.factory'
import { makePlayer } from '../factories/player.factory'
import { makeTeam } from '../factories/team.factory'
import { makePartialMatch, makeScenarioMatch } from './full-game.scenario'

export const TEAM_A_STAR_ID = 'player-1'

interface PlayerSeed {
  firstName: string
  id: string
  jerseyNumber: string
  lastName: string
  nicName: string
}

// 10 distinct players in two blocks of 5 (indices 0–4 = Team A, 5–9 = Team B). Index 0 of each block is Marius (star).
const PLAYERS: readonly PlayerSeed[] = [
  // --- Team A (Les Aigles) ---
  { id: 'player-1', firstName: 'Marius', lastName: 'Dupont', jerseyNumber: '07', nicName: 'Marius' }, // star
  { id: 'player-2', firstName: 'Lucas', lastName: 'Bernard', jerseyNumber: '11', nicName: 'Luca' }, // good
  { id: 'player-3', firstName: 'Théo', lastName: 'Moreau', jerseyNumber: '23', nicName: 'Théo' }, // avg
  { id: 'player-4', firstName: 'Noah', lastName: 'Lefebvre', jerseyNumber: '05', nicName: 'No' }, // avg
  { id: 'player-5', firstName: 'Ethan', lastName: 'Garcia', jerseyNumber: '14', nicName: 'Eth' }, // weak
  // --- Team B (Les Tigres) ---
  { id: 'player-6', firstName: 'Marius', lastName: 'Petit', jerseyNumber: '03', nicName: 'Mari' }, // star (no matches)
  { id: 'player-7', firstName: 'Hugo', lastName: 'Roux', jerseyNumber: '08', nicName: 'Hug' }, // good
  { id: 'player-8', firstName: 'Léo', lastName: 'Fontaine', jerseyNumber: '15', nicName: 'Léo' }, // avg
  { id: 'player-9', firstName: 'Adam', lastName: 'Girard', jerseyNumber: '21', nicName: 'Ad' }, // avg
  { id: 'player-10', firstName: 'Natan', lastName: 'Mercier', jerseyNumber: '32', nicName: 'Nat' }, // weak
]

const TEAM_A_ROSTER = PLAYERS.slice(0, 5).map((p) => p.id)
const TEAM_B_ROSTER = PLAYERS.slice(5).map((p) => p.id)

const DEMO_BASE_DATE = '2024-01-13T18:00:00.000Z'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function matchDate(weekOffset: number): string {
  return new Date(new Date(DEMO_BASE_DATE).getTime() + weekOffset * WEEK_MS).toISOString()
}

export interface DemoDataset {
  contacts: Contact[]
  matchs: Match[]
  players: Player[]
  teams: Team[]
}

/** Deterministic, fully-overridden dataset for the DEV demo button. */
export function seedDemoDataset(): DemoDataset {
  const players = PLAYERS.map((p) =>
    makePlayer({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      jerseyNumber: p.jerseyNumber,
      nicName: p.nicName,
    })
  )

  const teamA = makeTeam({ id: 'team-a', name: 'Les Aigles', playerIds: TEAM_A_ROSTER })
  const teamB = makeTeam({ id: 'team-b', name: 'Les Tigres', playerIds: TEAM_B_ROSTER })

  // 4 matches — all for team A (team B keeps zero matches), varied scenarios:
  const match1 = makeScenarioMatch('closeWin', 'team-a', TEAM_A_ROSTER, {
    opponent: 'Lions de Berlin',
    type: 'home',
    date: matchDate(0),
  })

  const match2 = makeScenarioMatch('blowoutWin', 'team-a', TEAM_A_ROSTER, {
    opponent: 'Panthers BC',
    type: 'outside',
    date: matchDate(1),
  })

  const match3 = makeScenarioMatch('blowoutLoss', 'team-a', TEAM_A_ROSTER, {
    opponent: 'Sharks United',
    type: 'home',
    date: matchDate(2),
  })

  const match4 = makePartialMatch('team-a', TEAM_A_ROSTER, {
    opponent: 'Eagles Junior',
    type: 'outside',
    date: matchDate(3),
  })

  // Contacts (last names aligned to new players)
  const contact1 = makeContact({
    id: 'contact-1',
    playerId: 'player-1',
    firstName: 'Marie',
    lastName: 'Dupont',
    relationship: 'mother',
    phone: '+33000000001',
  })
  const contact2 = makeContact({
    id: 'contact-2',
    playerId: 'player-2',
    firstName: 'Paul',
    lastName: 'Bernard',
    relationship: 'father',
    phone: '+33000000002',
  })

  return {
    teams: [teamA, teamB],
    players,
    matchs: [match1, match2, match3, match4],
    contacts: [contact1, contact2],
  }
}
