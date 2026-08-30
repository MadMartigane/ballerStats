// Staff-created players/contacts must be anchored to a team the staff can
// write to, so the read/write API rules stay enforceable via team_players:
// - a staff creator of a players record must send `teamIds` (teams of the
//   same club where they hold a team_members `write` row); the hook creates
//   the team_players junction rows.
// - a staff creator of a contacts record needs write access on a team that
//   already has the related player attached (team_players).
//
// NB! PB hook callbacks run in an isolated scope: all helpers are inlined
// and duplicated across the two handlers.

// skills used by both handlers:
// - findMembership(auth, clubId)   -> club_members row or null
// - staffWritableTeams(auth, club) -> team ids where access = "write"

onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    return e.next()
  }

  const auth = e.auth
  if (!auth) {
    throw new ApiError(403, 'authentication required')
  }

  const record = e.record
  const clubId = record.get('club')

  const membershipRows = $app.findRecordsByFilter(
    'club_members',
    'club = {:club} && user = {:user}',
    '',
    1,
    0,
    { club: clubId, user: auth.id }
  )
  if (!membershipRows.length) {
    throw new ApiError(403, 'no membership in the target club')
  }
  const clubRole = membershipRows[0].get('role')
  if (clubRole === 'owner' || clubRole === 'admin') {
    return e.next() // owner/admin can create freely
  }

  const writeRows = $app.findRecordsByFilter(
    'team_members',
    'club = {:club} && user = {:user} && access = "write"',
    '',
    200,
    0,
    { club: clubId, user: auth.id }
  )
  if (!writeRows.length) {
    throw new ApiError(403, 'staff must have write access on at least one team of this club')
  }
  const writableTeams = writeRows.map((r) => r.get('team'))

  const body = e.requestInfo().body
  const attachIds = Array.isArray(body.teamIds) ? [...new Set(body.teamIds.map(String))] : []
  if (!attachIds.length) {
    throw new ApiError(
      403,
      'staff must attach the new player to at least one team they can write (send teamIds)'
    )
  }

  for (const teamId of attachIds) {
    if (!writableTeams.includes(teamId)) {
      throw new ApiError(403, `no write access on team ${teamId}`)
    }
    const existing = $app.findRecordsByFilter(
      'team_players',
      'team = {:team} && player = {:player}',
      '',
      1,
      0,
      { team: teamId, player: record.id }
    )
    if (existing.length) {
      continue
    }
    const link = new Record($app.findCollectionByNameOrId('team_players'))
    link.set('club', clubId)
    link.set('team', teamId)
    link.set('player', record.id)
    try {
      $app.save(link)
    } catch (linkErr) {
      throw new ApiError(400, `failed to attach the player to team ${teamId}: ${linkErr}`)
    }
  }

  return e.next()
}, 'players')

onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    return e.next()
  }

  const auth = e.auth
  if (!auth) {
    throw new ApiError(403, 'authentication required')
  }

  const record = e.record
  const clubId = record.get('club')

  const membershipRows = $app.findRecordsByFilter(
    'club_members',
    'club = {:club} && user = {:user}',
    '',
    1,
    0,
    { club: clubId, user: auth.id }
  )
  if (!membershipRows.length) {
    throw new ApiError(403, 'no membership in the target club')
  }
  const clubRole = membershipRows[0].get('role')
  if (clubRole === 'owner' || clubRole === 'admin') {
    return e.next() // owner/admin can create freely
  }

  const writeRows = $app.findRecordsByFilter(
    'team_members',
    'club = {:club} && user = {:user} && access = "write"',
    '',
    200,
    0,
    { club: clubId, user: auth.id }
  )
  if (!writeRows.length) {
    throw new ApiError(403, 'staff must have write access on at least one team of this club')
  }
  const writableTeams = writeRows.map((r) => r.get('team'))

  const playerId = record.get('player')
  if (!playerId) {
    throw new ApiError(400, 'contact requires a player')
  }
  const links = $app.findRecordsByFilter('team_players', 'player = {:player}', '', 200, 0, {
    player: playerId,
  })
  const anchored = links.some((link) => writableTeams.includes(link.get('team')))
  if (!anchored) {
    throw new ApiError(
      403,
      'staff must have write access on a team containing this player'
    )
  }

  return e.next()
}, 'contacts')