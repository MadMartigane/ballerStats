import type Contact from '../../contact'
import type { ContactRelationship } from '../../contact/contact.d'
import type Match from '../../match'
import type Player from '../../player'
import type Team from '../../team'
import { makeContact } from '../factories/contact.factory'
import { makePlayer } from '../factories/player.factory'
import { makeTeam } from '../factories/team.factory'
import { makePartialMatch, makeScenarioMatch } from './full-game.scenario'

export const TEAM_A_STAR_ID = 'player-1'

const CHAMPIONSHIP = {
  REGULAR_SEASON: 'Saison régulière',
  WINTER_CUP: 'Coupe Hiver',
  FRIENDLY: 'Amical',
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
    id: 'player-1',
    firstName: 'Marius',
    lastName: 'Dupont',
    jerseyNumber: '07',
    licenseNumber: '1310000101',
    nicName: 'Marius',
  }, // star
  {
    id: 'player-2',
    firstName: 'Lucas',
    lastName: 'Bernard',
    jerseyNumber: '11',
    licenseNumber: '1310000102',
    nicName: 'Luca',
  }, // good
  {
    id: 'player-3',
    firstName: 'Théo',
    lastName: 'Moreau',
    jerseyNumber: '23',
    licenseNumber: '1310000103',
    nicName: 'Théo',
  }, // avg
  {
    id: 'player-4',
    firstName: 'Noah',
    lastName: 'Lefebvre',
    jerseyNumber: '05',
    licenseNumber: '1310000104',
    nicName: 'No',
  }, // avg
  {
    id: 'player-5',
    firstName: 'Ethan',
    lastName: 'Garcia',
    jerseyNumber: '14',
    licenseNumber: '1310000105',
    nicName: 'Eth',
  }, // weak
  // --- Team B (Les Tigres) ---
  {
    id: 'player-6',
    firstName: 'Marius',
    lastName: 'Petit',
    jerseyNumber: '03',
    licenseNumber: '1310000106',
    nicName: 'Mari',
  }, // star (no matches)
  {
    id: 'player-7',
    firstName: 'Hugo',
    lastName: 'Roux',
    jerseyNumber: '08',
    licenseNumber: '1310000107',
    nicName: 'Hug',
  }, // good
  {
    id: 'player-8',
    firstName: 'Léo',
    lastName: 'Fontaine',
    jerseyNumber: '15',
    licenseNumber: '1310000108',
    nicName: 'Léo',
  }, // avg
  {
    id: 'player-9',
    firstName: 'Adam',
    lastName: 'Girard',
    jerseyNumber: '21',
    licenseNumber: '1310000109',
    nicName: 'Ad',
  }, // avg
  {
    id: 'player-10',
    firstName: 'Natan',
    lastName: 'Mercier',
    jerseyNumber: '32',
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
    id: 'contact-1',
    playerId: 'player-1',
    firstName: 'Marie',
    lastName: 'Dupont',
    relationship: 'mother',
    phone: '+33612345671',
    email: 'marie.dupont@example.com',
    address: '12 Rue des Lilas, 13001 Marseille',
  },
  {
    id: 'contact-2',
    playerId: 'player-2',
    firstName: 'Paul',
    lastName: 'Bernard',
    relationship: 'father',
    phone: '+33612345672',
    email: 'paul.bernard@example.com',
    address: '4 Avenue de la Plage, 13007 Marseille',
  },
  {
    id: 'contact-3',
    playerId: 'player-3',
    firstName: 'Sophie',
    lastName: 'Moreau',
    relationship: 'mother',
    phone: '+33612345673',
    email: 'sophie.moreau@example.com',
    address: '28 Boulevard Michelet, 13008 Marseille',
  },
  {
    id: 'contact-4',
    playerId: 'player-4',
    firstName: 'Julien',
    lastName: 'Lefebvre',
    relationship: 'father',
    phone: '+33612345674',
    email: 'julien.lefebvre@example.com',
    address: '9 Rue Saint-Ferréol, 13001 Marseille',
  },
  {
    id: 'contact-5',
    playerId: 'player-5',
    firstName: 'Carmen',
    lastName: 'Garcia',
    relationship: 'mother',
    phone: '+33612345675',
    email: 'carmen.garcia@example.com',
    address: '17 Chemin du Vallon, 13011 Marseille',
  },
  {
    id: 'contact-6',
    playerId: 'player-6',
    firstName: 'Antoine',
    lastName: 'Petit',
    relationship: 'father',
    phone: '+33612345676',
    email: 'antoine.petit@example.com',
    address: '33 Rue de la République, 13002 Marseille',
  },
  {
    id: 'contact-7',
    playerId: 'player-7',
    firstName: 'Claire',
    lastName: 'Roux',
    relationship: 'mother',
    phone: '+33612345677',
    email: 'claire.roux@example.com',
    address: '5 Impasse des Oliviers, 13012 Marseille',
  },
  {
    id: 'contact-8',
    playerId: 'player-8',
    firstName: 'Nicolas',
    lastName: 'Fontaine',
    relationship: 'father',
    phone: '+33612345678',
    email: 'nicolas.fontaine@example.com',
    address: '21 Avenue du Prado, 13006 Marseille',
  },
  {
    id: 'contact-9',
    playerId: 'player-9',
    firstName: 'Sarah',
    lastName: 'Girard',
    relationship: 'mother',
    phone: '+33612345679',
    email: 'sarah.girard@example.com',
    address: '8 Rue de l’Église, 13005 Marseille',
  },
  {
    id: 'contact-10',
    playerId: 'player-10',
    firstName: 'Thomas',
    lastName: 'Mercier',
    relationship: 'other',
    phone: '+33612345680',
    email: 'thomas.mercier@example.com',
    address: '2 Place du Général de Gaulle, 13004 Marseille',
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
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      jerseyNumber: p.jerseyNumber,
      licenseNumber: p.licenseNumber,
      nicName: p.nicName,
    })
  )

  const contacts = CONTACTS.map((c) =>
    makeContact({
      id: c.id,
      playerId: c.playerId,
      firstName: c.firstName,
      lastName: c.lastName,
      relationship: c.relationship,
      phone: c.phone,
      email: c.email,
      address: c.address,
    })
  )

  const teamA = makeTeam({ id: 'team-a', name: 'Les Aigles', playerIds: TEAM_A_ROSTER })
  const teamB = makeTeam({ id: 'team-b', name: 'Les Tigres', playerIds: TEAM_B_ROSTER })

  // 4 matches — all for team A (team B keeps zero matches), varied scenarios:
  const match1 = makeScenarioMatch('closeWin', 'team-a', TEAM_A_ROSTER, {
    opponent: 'Lions de Berlin',
    type: 'home',
    date: matchDate(0),
    championship: CHAMPIONSHIP.REGULAR_SEASON,
  })

  const match2 = makeScenarioMatch('blowoutWin', 'team-a', TEAM_A_ROSTER, {
    opponent: 'Panthers BC',
    type: 'outside',
    date: matchDate(1),
    championship: CHAMPIONSHIP.REGULAR_SEASON,
  })

  const match3 = makeScenarioMatch('blowoutLoss', 'team-a', TEAM_A_ROSTER, {
    opponent: 'Sharks United',
    type: 'home',
    date: matchDate(2),
    championship: CHAMPIONSHIP.WINTER_CUP,
  })

  const match4 = makePartialMatch('team-a', TEAM_A_ROSTER, {
    opponent: 'Eagles Junior',
    type: 'outside',
    date: matchDate(3),
    championship: CHAMPIONSHIP.FRIENDLY,
  })

  return {
    teams: [teamA, teamB],
    players,
    matchs: [match1, match2, match3, match4],
    contacts,
  }
}
