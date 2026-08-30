// BallerStats users collection configuration.
// The default `users` auth collection is created by PocketBase on first start;
// this migration locks it down for the BallerStats model:
// - no public signup (createRule null)
// - users can view/update only their own record
// - auth via email/password only, no OAuth
// - user provisioning is done by the invite hook and the bootstrap script

migrate(
  (app) => {
    let users
    try {
      users = app.findCollectionByNameOrId('users')
    } catch {
      users = new Collection({
        type: 'auth',
        name: 'users',
        fields: [
          { name: 'email', type: 'email', required: true },
          { name: 'password', type: 'text', required: true },
        ],
        passwordAuth: { enabled: true },
        oauth2: { enabled: false, providers: [] },
        mfa: { enabled: false },
        otp: { enabled: false },
      })
    }

    users.authRule = '' // any valid users record can log in
    users.manageRule = null // invited/created via superuser or hooks
    users.listRule = null // no public user listing
    users.viewRule = 'id = @request.auth.id' // self view only
    users.createRule = null // no public signup
    users.updateRule = 'id = @request.auth.id' // self update
    users.deleteRule = null
    users.passwordAuth = { enabled: true }
    users.oauth2 = { enabled: false, providers: [] }
    users.mfa = { enabled: false }
    users.otp = { enabled: false }

    try {
      users.fields.getByName('name')
    } catch {
      users.fields.add(new TextField({ name: 'name', max: 200 }))
    }

    return app.save(users)
  },
  (app) => {
    // no-op revert: users is a system collection
  }
)