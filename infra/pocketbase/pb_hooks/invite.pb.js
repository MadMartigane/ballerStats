// Club member invitation (no SMTP: the generated password is returned once).
// Also a users/enrich route so owner/admin can resolve names of their club's
// members without opening the users collection.
//
// NB! PB hook callbacks run in an isolated scope: every helper below is
// inlined inside the routerAdd handlers.

// POST /api/baller/invite
// Body: { email, name?, role?: "staff"|"admin", teamId?, access?: "read"|"write" }
// Response: { email, password, userId }
routerAdd(
  'POST',
  '/api/baller/invite',
  (c) => {
    const auth = c.auth
    const body = c.requestInfo().body

    const email = String(body.email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, 'invalid email')
    }

    const role = body.role || 'staff'
    if (role !== 'staff' && role !== 'admin') {
      throw new ApiError(400, 'role must be "staff" or "admin"')
    }
    // never assign owner via invite
    if (role === 'owner') {
      throw new ApiError(400, 'role "owner" cannot be assigned via invite')
    }

    // v1: resolve the caller's club from their first membership (one club assumed)
    const memberships = $app.findRecordsByFilter(
      'club_members',
      'user = {:user}',
      '',
      1,
      0,
      { user: auth.id }
    )
    if (!memberships.length) {
      throw new ApiError(403, 'not a club member')
    }
    const callerRole = memberships[0].get('role')
    if (callerRole !== 'owner' && callerRole !== 'admin') {
      throw new ApiError(403, 'only club owner/admin can invite')
    }
    const clubId = memberships[0].get('club')

    // create the user, or reuse an existing account (idempotent)
    let user
    try {
      user = $app.findAuthRecordByEmail('users', email)
    } catch {
      user = null
    }
    let password = null
    if (!user) {
      // no $security in some pb_hooks scopes: generate locally (12 ascii-safe chars)
      const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
      password = Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
      user = new Record($app.findCollectionByNameOrId('users'))
      user.set('email', email)
      user.set('password', password)
      const name = String(body.name || '').trim().slice(0, 200)
      if (name) {
        user.set('name', name)
      }
      try {
        $app.save(user)
      } catch (err) {
        throw new ApiError(400, `failed to create user: ${err}`)
      }
    }

    // club membership (duplicate invite is tolerated)
    try {
      const cm = new Record($app.findCollectionByNameOrId('club_members'))
      cm.set('club', clubId)
      cm.set('user', user.id)
      cm.set('role', role)
      $app.save(cm)
    } catch {
      // already a member
    }

    // optional team membership
    if (body.teamId) {
      let team
      try {
        team = $app.findRecordById('teams', String(body.teamId))
      } catch {
        throw new ApiError(400, 'team not found')
      }
      if (team.get('club') !== clubId) {
        throw new ApiError(400, 'team must belong to your club')
      }
      const access = body.access === 'write' ? 'write' : 'read'
      try {
        const tm = new Record($app.findCollectionByNameOrId('team_members'))
        tm.set('club', clubId)
        tm.set('team', team.id)
        tm.set('user', user.id)
        tm.set('access', access)
        $app.save(tm)
      } catch {
        // already a team member
      }
    }

    return c.json(200, { email, password, userId: user.id })
  },
  $apis.requireAuth()
)

// POST /api/baller/users/enrich
// Body: { ids: string[] }
// Response: { users: [{ id, name, email }] }
// Restricted to the caller's own club and only for actual members.
routerAdd(
  'POST',
  '/api/baller/users/enrich',
  (c) => {
    const auth = c.auth
    const body = c.requestInfo().body

    const rawIds = Array.isArray(body.ids) ? body.ids.map(String) : []
    const ids = [...new Set(rawIds.filter((id) => id !== auth.id))]

    const memberships = $app.findRecordsByFilter(
      'club_members',
      'user = {:user}',
      '',
      1,
      0,
      { user: auth.id }
    )
    if (!memberships.length) {
      throw new ApiError(403, 'not a club member')
    }
    const clubId = memberships[0].get('club')

    const users = []
    for (const id of ids) {
      const rows = $app.findRecordsByFilter(
        'club_members',
        'club = {:club} && user = {:user}',
        '',
        1,
        0,
        { club: clubId, user: id }
      )
      if (!rows.length) continue

      let u
      try {
        u = $app.findRecordById('users', id)
      } catch {
        continue
      }
      users.push({ id, name: u.get('name'), email: u.get('email') })
    }

    return c.json(200, { users })
  },
  $apis.requireAuth()
)