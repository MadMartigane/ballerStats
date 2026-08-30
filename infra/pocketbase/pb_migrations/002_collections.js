// BallerStats collections (structure only, rules are set in 003_rules after
// all back-relation targets exist).

migrate(
  (app) => {
    // clubs -----------------------------------------------------------------
    const clubs = new Collection({
      type: 'base',
      name: 'clubs',
      fields: [
        { name: 'name', type: 'text', required: true, max: 200 },
        {
          name: 'owner',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
      ],
    })
    app.save(clubs)

    // club_members ----------------------------------------------------------
    const clubMembers = new Collection({
      type: 'base',
      name: 'club_members',
      fields: [
        { name: 'club', type: 'relation', collectionId: clubs.id, maxSelect: 1, required: true },
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        {
          name: 'role',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['owner', 'admin', 'staff'],
        },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_unq_club_members ON club_members (club, user)'],
    })
    app.save(clubMembers)

    // teams -------------------------------------------------------------------
    const teams = new Collection({
      type: 'base',
      name: 'teams',
      fields: [
        { name: 'club', type: 'relation', collectionId: clubs.id, maxSelect: 1, required: true },
        { name: 'name', type: 'text', required: true, max: 200 },
        { name: 'playerIds', type: 'json' },
        { name: 'trombiTitle', type: 'text', max: 200 },
        { name: 'updatedAt', type: 'number' },
        { name: 'deletedAt', type: 'number' },
      ],
    })
    app.save(teams)

    // team_members --------------------------------------------------------------
    const teamMembers = new Collection({
      type: 'base',
      name: 'team_members',
      fields: [
        { name: 'club', type: 'relation', collectionId: clubs.id, maxSelect: 1, required: true },
        { name: 'team', type: 'relation', collectionId: teams.id, maxSelect: 1, required: true },
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: true,
        },
        {
          name: 'access',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['read', 'write'],
        },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_unq_team_members ON team_members (team, user)'],
    })
    app.save(teamMembers)

    // players ---------------------------------------------------------------------
    const players = new Collection({
      type: 'base',
      name: 'players',
      fields: [
        { name: 'club', type: 'relation', collectionId: clubs.id, maxSelect: 1, required: true },
        { name: 'firstName', type: 'text', max: 200 },
        { name: 'lastName', type: 'text', max: 200 },
        { name: 'nicName', type: 'text', max: 200 },
        { name: 'jerseyNumber', type: 'text', max: 20 },
        { name: 'licenseNumber', type: 'text', max: 100 },
        { name: 'birthDay', type: 'text', max: 50 },
        { name: 'email', type: 'text', max: 200 },
        { name: 'phone', type: 'text', max: 50 },
        { name: 'hasPhoto', type: 'bool' },
        {
          name: 'photo',
          type: 'file',
          maxSelect: 1,
          maxSize: 2097152,
          mimeTypes: ['image/webp', 'image/jpeg', 'image/png'],
        },
        { name: 'updatedAt', type: 'number' },
        { name: 'deletedAt', type: 'number' },
      ],
    })
    app.save(players)

    // team_players ------------------------------------------------------------------
    const teamPlayers = new Collection({
      type: 'base',
      name: 'team_players',
      fields: [
        { name: 'club', type: 'relation', collectionId: clubs.id, maxSelect: 1, required: true },
        { name: 'team', type: 'relation', collectionId: teams.id, maxSelect: 1, required: true },
        {
          name: 'player',
          type: 'relation',
          collectionId: players.id,
          maxSelect: 1,
          required: true,
        },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_unq_team_players ON team_players (team, player)'],
    })
    app.save(teamPlayers)

    // contacts -------------------------------------------------------------------------
    const contacts = new Collection({
      type: 'base',
      name: 'contacts',
      fields: [
        { name: 'club', type: 'relation', collectionId: clubs.id, maxSelect: 1, required: true },
        {
          name: 'player',
          type: 'relation',
          collectionId: players.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'playerId', type: 'text', max: 50 },
        { name: 'relationship', type: 'text', max: 100 },
        { name: 'firstName', type: 'text', max: 200 },
        { name: 'lastName', type: 'text', max: 200 },
        { name: 'phone', type: 'text', max: 50 },
        { name: 'email', type: 'text', max: 200 },
        { name: 'address', type: 'text', max: 300 },
        { name: 'updatedAt', type: 'number' },
        { name: 'deletedAt', type: 'number' },
      ],
    })
    app.save(contacts)

    // matchs ------------------------------------------------------------------------------
    const matchs = new Collection({
      type: 'base',
      name: 'matchs',
      fields: [
        { name: 'club', type: 'relation', collectionId: clubs.id, maxSelect: 1, required: true },
        { name: 'team', type: 'relation', collectionId: teams.id, maxSelect: 1, required: true },
        { name: 'opponent', type: 'text', max: 200 },
        { name: 'type', type: 'text', max: 50 },
        { name: 'date', type: 'text', max: 50 },
        { name: 'championship', type: 'text', max: 200 },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['unlocked', 'locked'],
        },
        { name: 'playersInTheFive', type: 'json' },
        { name: 'stats', type: 'json' },
        {
          name: 'scorer',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: false,
        },
        { name: 'scorerLockUntil', type: 'date' },
        { name: 'updatedAt', type: 'number' },
        { name: 'deletedAt', type: 'number' },
      ],
    })
    app.save(matchs)
  },
  (app) => {
    for (const name of ['matchs', 'contacts', 'team_players', 'players', 'team_members', 'teams', 'club_members', 'clubs']) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch {
        // already deleted, ignore
      }
    }
  }
)