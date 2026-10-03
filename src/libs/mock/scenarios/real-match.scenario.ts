import Club from '../../club/club'
import type Contact from '../../contact/contact'
import Match from '../../match/match'
import type Player from '../../player/player'
import type Team from '../../team/team'
import { makePlayer } from '../factories/player.factory'
import { makeTeam } from '../factories/team.factory'
import { U13_SAMPLE_MATCH } from '../fixtures/u13-sample-match'
import type { DemoDataset } from './demo-dataset.scenario'

const DEMO_CLUB_ID = 'club-demo-u13'
const DEMO_CLUB_NAME = 'Club Démo'
const DEMO_CLUB_LICENSE = '0000000000'

const DEMO_TEAM_ID = 'team-u13'
const DEMO_TEAM_NAME = 'Équipe Démo U13'

const DEMO_MATCH_ID = 'match-u13'
// Real date shifted by exactly one week so the demo never points at a real fixture.
const DEMO_MATCH_DATE = '2026-09-12T15:30'

/** First five `fiveIn` player ids of the match, i.e. the starting five. */
const STARTING_FIVE = ['u13-p4', 'u13-p2', 'u13-p1', 'u13-p6', 'u13-p3']

/**
 * Dataset built from one anonymised real U13 match.
 *
 * It replaces the synthetic demo dataset as the DEV seed because the synthetic
 * one never produced `gameStart`/`gameStop`/`fiveIn`/`fiveOut` events, so the
 * play-time feature had nothing real to chew on.
 *
 * Privacy: every player is a pseudonym with `hasPhoto: false` and a `DEMO000n`
 * licence number, and `contacts` is intentionally empty — the source data
 * belongs to minors and their parents, so only the non-identifying basketball
 * facts (events, timestamps, jerseys, roster shape) are carried over.
 */
export function seedRealMatchDataset(): DemoDataset {
  const players: Player[] = U13_SAMPLE_MATCH.players.map((fixturePlayer, index) =>
    makePlayer({
      clubId: DEMO_CLUB_ID,
      firstName: fixturePlayer.firstName,
      hasPhoto: false,
      id: fixturePlayer.id,
      jerseyNumber: fixturePlayer.jerseyNumber,
      lastName: fixturePlayer.lastName,
      licenseNumber: `DEMO${String(index + 1).padStart(4, '0')}`,
    })
  )

  const team: Team = makeTeam({
    category: 'U13',
    clubId: DEMO_CLUB_ID,
    id: DEMO_TEAM_ID,
    name: DEMO_TEAM_NAME,
    playerIds: [...U13_SAMPLE_MATCH.teamRosterIds],
  })

  const match = new Match({
    championship: 'Démo U13',
    date: DEMO_MATCH_DATE,
    id: DEMO_MATCH_ID,
    // The format this real match was played under, recorded as data rather than
    // derived from a preset the committee can change after the fact.
    matchFormat: { periodLengthMinutes: 8, periods: 4, playersOnCourt: 5 },
    opponent: 'Adversaires Démo',
    playersInTheFive: STARTING_FIVE,
    stats: [...U13_SAMPLE_MATCH.stats],
    status: 'locked',
    teamId: DEMO_TEAM_ID,
    type: 'home',
  })

  const contacts: Contact[] = []

  return {
    clubs: [new Club({ id: DEMO_CLUB_ID, licenseNumber: DEMO_CLUB_LICENSE, name: DEMO_CLUB_NAME })],
    contacts,
    matchs: [match],
    players,
    teams: [team],
  }
}
