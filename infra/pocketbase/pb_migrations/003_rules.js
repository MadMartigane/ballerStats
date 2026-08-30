// BallerStats API rules.
//
// Back-relations (X_via_field) resolve to multiple related records, so they
// are compared with the any-of operators (`?=`, `?!=`).

migrate(
  (app) => {
    const isClubMember = (backRel) => `${backRel}.user ?= @request.auth.id`
    // owner/admin of the club referenced by the current record's `club` field
    const isOwnerOrAdmin = (backRel) =>
      `${backRel}.user ?= @request.auth.id && (${backRel}.role ?= "owner" || ${backRel}.role ?= "admin")`
    // owner/admin of the club object queried as the record itself (`club_members_via_club`)
    const isOwnerOrAdminOfThis = isOwnerOrAdmin('club_members_via_club')
    // owner/admin of the club referenced by the current record's `club` field
    const isOwnerOrAdminOfRecordClub = isOwnerOrAdmin('club.club_members_via_club')
    // staff has any team_members row on this team with the given access
    const teamAccess = (access) => `team.team_members_via_team.user ?= @request.auth.id && team.team_members_via_team.access ?= "${access}"`
    // staff has write via a team that has this player attached
    const playerTeamWrite = (path) =>
      `${path}.team.team_members_via_team.user ?= @request.auth.id && ${path}.team.team_members_via_team.access ?= "write"`

    {
      const c = app.findCollectionByNameOrId('clubs')
      c.listRule = isClubMember('club_members_via_club')
      c.viewRule = isClubMember('club_members_via_club')
      c.createRule = '@request.auth.id != ""' // first club (not enforced how many)
      c.updateRule = `owner = @request.auth.id || ${isOwnerOrAdminOfThis}`
      c.deleteRule = `owner = @request.auth.id || ${isOwnerOrAdminOfThis}`
      app.save(c)
    }

    {
      const c = app.findCollectionByNameOrId('club_members')
      const manageRule = (ref) =>
        `@request.auth.club_members_via_user.club ?= ${ref} && (@request.auth.club_members_via_user.role ?= "owner" || @request.auth.club_members_via_user.role ?= "admin")`
      const isOwnerCheck = (ref) => `@request.auth.club_members_via_user.club ?= ${ref} && @request.auth.club_members_via_user.role ?= "owner"`
      c.listRule = isClubMember('club.club_members_via_club')
      c.viewRule = isClubMember('club.club_members_via_club')
      c.createRule = `@request.auth.id != "" && ${manageRule('@request.body.club')} && (@request.body.role != "owner" || ${isOwnerCheck('@request.body.club')})`
      c.updateRule = `${manageRule('club')} && (@request.body.role:changed = false || @request.body.role != "owner" || ${isOwnerCheck('club')})`
      c.deleteRule = manageRule('club')
      app.save(c)
    }

    {
      const c = app.findCollectionByNameOrId('teams')
      c.listRule = `${isClubMember('club.club_members_via_club')} && (${isOwnerOrAdmin('club.club_members_via_club')} || team_members_via_team.user ?= @request.auth.id)`
      c.viewRule = c.listRule
      c.createRule = `@request.auth.id != "" && @request.auth.club_members_via_user.club ?= @request.body.club && (@request.auth.club_members_via_user.role ?= "owner" || @request.auth.club_members_via_user.role ?= "admin")`
      c.updateRule = isOwnerOrAdminOfRecordClub
      c.deleteRule = isOwnerOrAdminOfRecordClub
      app.save(c)
    }

    {
      const c = app.findCollectionByNameOrId('team_members')
      c.listRule = `${isOwnerOrAdminOfRecordClub} || user = @request.auth.id`
      c.viewRule = c.listRule
      c.createRule = `@request.auth.id != "" && @request.auth.club_members_via_user.club ?= @request.body.club && (@request.auth.club_members_via_user.role ?= "owner" || @request.auth.club_members_via_user.role ?= "admin") && @collection.teams.id ?= @request.body.team && @collection.teams.club ?= @request.body.club`
      c.updateRule = isOwnerOrAdminOfRecordClub
      c.deleteRule = isOwnerOrAdminOfRecordClub
      app.save(c)
    }

    {
      const c = app.findCollectionByNameOrId('team_players')
      c.listRule = `${isClubMember('club.club_members_via_club')} && (${isOwnerOrAdmin('club.club_members_via_club')} || team.team_members_via_team.user ?= @request.auth.id)`
      c.viewRule = c.listRule
      c.createRule = `@request.auth.id != "" && @request.auth.club_members_via_user.club ?= @request.body.club && (@request.auth.club_members_via_user.role ?= "owner" || @request.auth.club_members_via_user.role ?= "admin" || (@request.auth.team_members_via_user.team ?= @request.body.team && @request.auth.team_members_via_user.access ?= "write")) && @collection.teams.id ?= @request.body.team && @collection.teams.club ?= @request.body.club && @collection.players.id ?= @request.body.player && @collection.players.club ?= @request.body.club`
      c.updateRule = `${isOwnerOrAdminOfRecordClub} || ${teamAccess('write')}`
      c.deleteRule = c.updateRule
      app.save(c)
    }

    {
      const c = app.findCollectionByNameOrId('players')
      const staffView = playerTeamWrite('team_players_via_player')
      c.listRule = `${isClubMember('club.club_members_via_club')} && (${isOwnerOrAdmin('club.club_members_via_club')} || ${staffView})`
      c.viewRule = c.listRule
      // any club member may create; the players_attach hook enforces that a
      // staff creator attaches the player to a writable team
      c.createRule = `@request.auth.id != "" && @request.auth.club_members_via_user.club ?= @request.body.club`
      c.updateRule = `${isOwnerOrAdminOfRecordClub} || (${playerTeamWrite('team_players_via_player')} && ${isClubMember('club.club_members_via_club')})`
      c.deleteRule = c.updateRule
      app.save(c)
    }

    {
      const c = app.findCollectionByNameOrId('contacts')
      const staffView = playerTeamWrite('player.team_players_via_player')
      c.listRule = `${isClubMember('club.club_members_via_club')} && (${isOwnerOrAdmin('club.club_members_via_club')} || ${staffView})`
      c.viewRule = c.listRule
      c.createRule = `@request.auth.id != "" && @request.auth.club_members_via_user.club ?= @request.body.club`
      c.updateRule = `${isOwnerOrAdminOfRecordClub} || (${playerTeamWrite('player.team_players_via_player')} && ${isClubMember('club.club_members_via_club')})`
      c.deleteRule = c.updateRule
      app.save(c)
    }

    {
      const c = app.findCollectionByNameOrId('matchs')
      const teamWrite = `team.team_members_via_team.user ?= @request.auth.id && team.team_members_via_team.access ?= "write"`
      c.listRule = `${isClubMember('club.club_members_via_club')} && (${isOwnerOrAdmin('club.club_members_via_club')} || team.team_members_via_team.user ?= @request.auth.id)`
      c.viewRule = c.listRule
      c.createRule = `@request.auth.id != "" && @request.auth.club_members_via_user.club ?= @request.body.club && (@request.auth.club_members_via_user.role ?= "owner" || @request.auth.club_members_via_user.role ?= "admin" || (@request.auth.team_members_via_user.team ?= @request.body.team && @request.auth.team_members_via_user.access ?= "write")) && @collection.teams.id ?= @request.body.team && @collection.teams.club ?= @request.body.club`
      c.updateRule = `${isOwnerOrAdminOfRecordClub} || ${teamWrite}`
      c.deleteRule = c.updateRule
      app.save(c)
    }
  },
  (app) => {
    // rule revert is handled by 002's revert (collections deletion)
  }
)