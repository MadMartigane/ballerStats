import { createEffect } from 'solid-js'
import { currentClub, isLoggedIn } from '../auth/auth'
import { syncManager } from './sync-manager'

/** Invisible component: starts the sync loop after login, stops it on logout. */
export default function SyncInit() {
  createEffect(() => {
    const clubId = currentClub.get()?.id
    if (isLoggedIn() && clubId) {
      syncManager.start()
    } else {
      syncManager.stop()
    }
  })

  return null
}
