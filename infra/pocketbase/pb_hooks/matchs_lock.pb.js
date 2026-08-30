// Scoring lease for matchs:
// - `stats` and `playersInTheFive` can only be edited by the active scorer
//   while scorerLockUntil is in the future, or by the club owner/admin.
// - POST /api/baller/matchs/{id}/acquire grabs (or renews) the lease.
//
// NB! PB hook callbacks run in an isolated scope: all helpers are inlined.

routerAdd(
  'POST',
  '/api/baller/matchs/{id}/acquire',
  (c) => {
    const auth = c.auth
    const matchId = c.request.pathValue('id')

    let match
    try {
      match = $app.findRecordById('matchs', matchId)
    } catch {
      throw new ApiError(404, 'match not found')
    }

    const clubId = match.get('club')
    const body = c.requestInfo().body
    const force = Boolean(body) && body.force === true

    const scorerId = match.get('scorer')
    let lockUntil = match.get('scorerLockUntil')
    let expired = true
    if (lockUntil) {
      expired = new Date(String(lockUntil)).getTime() <= Date.now()
    }

    // caller already an owner/admin of the match club?
    const rows = $app.findRecordsByFilter(
      'club_members',
      'club = {:club} && user = {:user}',
      '',
      1,
      0,
      { club: clubId, user: auth.id }
    )
    const isManager =
      rows.length > 0 && (rows[0].get('role') === 'owner' || rows[0].get('role') === 'admin')

    if (!force && !expired && scorerId && scorerId !== auth.id) {
      // Expose the holder so the scoring screen can show who is scoring.
      let holder = null
      try {
        const holderUser = $app.findRecordById('users', scorerId)
        holder = { id: holderUser.id, name: holderUser.get('name'), email: holderUser.get('email') }
      } catch {
        holder = { id: scorerId, name: null, email: null }
      }
      throw new ApiError(409, 'scoring lease is held by another user', { holder })
    }

    if (force && !isManager) {
      throw new ApiError(403, 'only club owner/admin can force the lease')
    }

    match.set('scorer', auth.id)
    match.set('scorerLockUntil', new Date(Date.now() + 45 * 1000).toISOString())

    try {
      $app.save(match)
    } catch (err) {
      throw new ApiError(400, `failed to acquire the scoring lease: ${err}`)
    }

    return c.json(200, {
      scorer: auth.id,
      scorerLockUntil: match.get('scorerLockUntil'),
      expiresInSeconds: 45,
    })
  },
  $apis.requireAuth()
)

// POST /api/baller/matchs/{id}/release
// Clears scorer + scorerLockUntil. Any authenticated caller may release (it is
// harmless, the lease just becomes free) — the matchs update rule only covers
// owner/admin or team-write members, which the active scorer is not guaranteed
// to be, and the lease hook only gates `stats`/`playersInTheFive` changes.
routerAdd(
  'POST',
  '/api/baller/matchs/{id}/release',
  (c) => {
    const matchId = c.request.pathValue('id')

    let match
    try {
      match = $app.findRecordById('matchs', matchId)
    } catch {
      throw new ApiError(404, 'match not found')
    }

    match.set('scorer', null)
    match.set('scorerLockUntil', null)

    try {
      $app.save(match)
    } catch (err) {
      throw new ApiError(400, `failed to release the scoring lease: ${err}`)
    }

    return c.json(200, { scorer: null, scorerLockUntil: null })
  },
  $apis.requireAuth()
)

// Gate score edits while the lease is held. Superusers (dashboard) bypass.
onRecordUpdateRequest((e) => {
  const record = e.record
  const old = record.original()

  const scoreChanged = ['stats', 'playersInTheFive'].some((name) => {
    const before = old ? old.get(name) : null
    const after = record.get(name)
    return JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)
  })
  if (!scoreChanged) {
    return e.next()
  }

  // admin dashboard / superuser
  if (e.hasSuperuserAuth()) {
    return e.next()
  }

  const auth = e.auth
  if (!auth) {
    throw new ApiError(403, 'authentication required to edit match stats')
  }

  const clubId = record.get('club')
  if (clubId) {
    const rows = $app.findRecordsByFilter(
      'club_members',
      'club = {:club} && user = {:user}',
      '',
      1,
      0,
      { club: clubId, user: auth.id }
    )
    if (rows.length > 0 && (rows[0].get('role') === 'owner' || rows[0].get('role') === 'admin')) {
      return e.next()
    }
  }

  const scorerId = record.get('scorer')
  let lockUntil = record.get('scorerLockUntil')
  let active = false
  if (lockUntil) {
    active = new Date(String(lockUntil)).getTime() > Date.now()
  }

  if (scorerId === auth.id && active) {
    return e.next()
  }

  throw new ApiError(
    403,
    'scoring is locked: only the active scorer (while the lease is alive) or a club owner/admin can edit stats'
  )
}, 'matchs')