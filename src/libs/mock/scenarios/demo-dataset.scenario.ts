import type Contact from '../../contact/contact'
import type { ContactRelationship } from '../../contact/contact.d'
import type Match from '../../match/match'
import type Player from '../../player/player'
import type Team from '../../team/team'
import { makeContact } from '../factories/contact.factory'
import { makePlayer } from '../factories/player.factory'
import { makeTeam } from '../factories/team.factory'
import { makePartialMatch, makeScenarioMatch } from './full-game.scenario'

export const TEAM_A_STAR_ID = 'player-1'

const CHAMPIONSHIP = {
  FRIENDLY: 'Amical',
  REGULAR_SEASON: 'Saison régulière',
  WINTER_CUP: 'Coupe Hiver',
} as const

interface PlayerSeed {
  firstName: string
  id: string
  jerseyNumber: string
  lastName: string
  licenseNumber: string
  nicName: string
}

// 10 distinct players in two blocks of 5 (indices 0–4 = Team A, 5–9 = Team B). Index 0 of each block is Marius (star).
const PLAYERS: readonly PlayerSeed[] = [
  // --- Team A (Les Aigles) ---
  {
    firstName: 'Marius',
    id: 'player-1',
    jerseyNumber: '07',
    lastName: 'Dupont',
    licenseNumber: '1310000101',
    nicName: 'Marius',
  }, // star
  {
    firstName: 'Lucas',
    id: 'player-2',
    jerseyNumber: '11',
    lastName: 'Bernard',
    licenseNumber: '1310000102',
    nicName: 'Luca',
  }, // good
  {
    firstName: 'Théo',
    id: 'player-3',
    jerseyNumber: '23',
    lastName: 'Moreau',
    licenseNumber: '1310000103',
    nicName: 'Théo',
  }, // avg
  {
    firstName: 'Noah',
    id: 'player-4',
    jerseyNumber: '05',
    lastName: 'Lefebvre',
    licenseNumber: '1310000104',
    nicName: 'No',
  }, // avg
  {
    firstName: 'Ethan',
    id: 'player-5',
    jerseyNumber: '14',
    lastName: 'Garcia',
    licenseNumber: '1310000105',
    nicName: 'Eth',
  }, // weak
  // --- Team B (Les Tigres) ---
  {
    firstName: 'Marius',
    id: 'player-6',
    jerseyNumber: '03',
    lastName: 'Petit',
    licenseNumber: '1310000106',
    nicName: 'Mari',
  }, // star (no matches)
  {
    firstName: 'Hugo',
    id: 'player-7',
    jerseyNumber: '08',
    lastName: 'Roux',
    licenseNumber: '1310000107',
    nicName: 'Hug',
  }, // good
  {
    firstName: 'Léo',
    id: 'player-8',
    jerseyNumber: '15',
    lastName: 'Fontaine',
    licenseNumber: '1310000108',
    nicName: 'Léo',
  }, // avg
  {
    firstName: 'Adam',
    id: 'player-9',
    jerseyNumber: '21',
    lastName: 'Girard',
    licenseNumber: '1310000109',
    nicName: 'Ad',
  }, // avg
  {
    firstName: 'Natan',
    id: 'player-10',
    jerseyNumber: '32',
    lastName: 'Mercier',
    licenseNumber: '1310000110',
    nicName: 'Nat',
  }, // weak
]

const TEAM_A_ROSTER = PLAYERS.slice(0, 5).map((p) => p.id)
const TEAM_B_ROSTER = PLAYERS.slice(5).map((p) => p.id)

interface ContactSeed {
  address: string
  email: string
  firstName: string
  id: string
  lastName: string
  phone: string
  playerId: string
  relationship: ContactRelationship
}

// One complete contact per player (every field has a value).
const CONTACTS: readonly ContactSeed[] = [
  {
    address: '12 Rue des Lilas, 13001 Marseille',
    email: 'marie.dupont@example.com',
    firstName: 'Marie',
    id: 'contact-1',
    lastName: 'Dupont',
    phone: '+33612345671',
    playerId: 'player-1',
    relationship: 'mother',
  },
  {
    address: '4 Avenue de la Plage, 13007 Marseille',
    email: 'paul.bernard@example.com',
    firstName: 'Paul',
    id: 'contact-2',
    lastName: 'Bernard',
    phone: '+33612345672',
    playerId: 'player-2',
    relationship: 'father',
  },
  {
    address: '28 Boulevard Michelet, 13008 Marseille',
    email: 'sophie.moreau@example.com',
    firstName: 'Sophie',
    id: 'contact-3',
    lastName: 'Moreau',
    phone: '+33612345673',
    playerId: 'player-3',
    relationship: 'mother',
  },
  {
    address: '9 Rue Saint-Ferréol, 13001 Marseille',
    email: 'julien.lefebvre@example.com',
    firstName: 'Julien',
    id: 'contact-4',
    lastName: 'Lefebvre',
    phone: '+33612345674',
    playerId: 'player-4',
    relationship: 'father',
  },
  {
    address: '17 Chemin du Vallon, 13011 Marseille',
    email: 'carmen.garcia@example.com',
    firstName: 'Carmen',
    id: 'contact-5',
    lastName: 'Garcia',
    phone: '+33612345675',
    playerId: 'player-5',
    relationship: 'mother',
  },
  {
    address: '33 Rue de la République, 13002 Marseille',
    email: 'antoine.petit@example.com',
    firstName: 'Antoine',
    id: 'contact-6',
    lastName: 'Petit',
    phone: '+33612345676',
    playerId: 'player-6',
    relationship: 'father',
  },
  {
    address: '5 Impasse des Oliviers, 13012 Marseille',
    email: 'claire.roux@example.com',
    firstName: 'Claire',
    id: 'contact-7',
    lastName: 'Roux',
    phone: '+33612345677',
    playerId: 'player-7',
    relationship: 'mother',
  },
  {
    address: '21 Avenue du Prado, 13006 Marseille',
    email: 'nicolas.fontaine@example.com',
    firstName: 'Nicolas',
    id: 'contact-8',
    lastName: 'Fontaine',
    phone: '+33612345678',
    playerId: 'player-8',
    relationship: 'father',
  },
  {
    address: '8 Rue de l’Église, 13005 Marseille',
    email: 'sarah.girard@example.com',
    firstName: 'Sarah',
    id: 'contact-9',
    lastName: 'Girard',
    phone: '+33612345679',
    playerId: 'player-9',
    relationship: 'mother',
  },
  {
    address: '2 Place du Général de Gaulle, 13004 Marseille',
    email: 'thomas.mercier@example.com',
    firstName: 'Thomas',
    id: 'contact-10',
    lastName: 'Mercier',
    phone: '+33612345680',
    playerId: 'player-10',
    relationship: 'other',
  },
]

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
      firstName: p.firstName,
      id: p.id,
      jerseyNumber: p.jerseyNumber,
      lastName: p.lastName,
      licenseNumber: p.licenseNumber,
      nicName: p.nicName,
    })
  )

  const contacts = CONTACTS.map((c) =>
    makeContact({
      address: c.address,
      email: c.email,
      firstName: c.firstName,
      id: c.id,
      lastName: c.lastName,
      phone: c.phone,
      playerId: c.playerId,
      relationship: c.relationship,
    })
  )

  const teamA = makeTeam({ id: 'team-a', name: 'Les Aigles', playerIds: TEAM_A_ROSTER })
  const teamB = makeTeam({ id: 'team-b', name: 'Les Tigres', playerIds: TEAM_B_ROSTER })

  // 4 matches — all for team A (team B keeps zero matches), varied scenarios:
  const match1 = makeScenarioMatch('closeWin', 'team-a', TEAM_A_ROSTER, {
    championship: CHAMPIONSHIP.REGULAR_SEASON,
    date: matchDate(0),
    opponent: 'Lions de Berlin',
    type: 'home',
  })

  const match2 = makeScenarioMatch('blowoutWin', 'team-a', TEAM_A_ROSTER, {
    championship: CHAMPIONSHIP.REGULAR_SEASON,
    date: matchDate(1),
    opponent: 'Panthers BC',
    type: 'outside',
  })

  const match3 = makeScenarioMatch('blowoutLoss', 'team-a', TEAM_A_ROSTER, {
    championship: CHAMPIONSHIP.WINTER_CUP,
    date: matchDate(2),
    opponent: 'Sharks United',
    type: 'home',
  })

  const match4 = makePartialMatch('team-a', TEAM_A_ROSTER, {
    championship: CHAMPIONSHIP.FRIENDLY,
    date: matchDate(3),
    opponent: 'Eagles Junior',
    type: 'outside',
  })

  return {
    contacts,
    matchs: [match1, match2, match3, match4],
    players,
    teams: [teamA, teamB],
  }
}
