// BallerStats application settings.

migrate(
  (app) => {
    const settings = app.settings()
    settings.meta.appName = 'BallerStats'
    return app.save(settings)
  },
  (app) => {
    // no-op revert
  }
)