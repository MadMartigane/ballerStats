import { A } from '@solidjs/router'
import { LogIn, LogOut } from 'lucide-solid'
import { Show } from 'solid-js'
import { currentClub, currentRole, currentUser, isLoggedIn, logout, ROLE_LABELS } from '../libs/auth/auth'
import { goTo } from '../libs/utils/utils'

function handleLogout() {
  logout()
  goTo('/')
}

export default function User() {
  const user = () => currentUser.get()
  const club = () => currentClub.get()
  const roleLabel = () => {
    const role = currentRole.get()
    return role ? ROLE_LABELS[role] : '—'
  }

  return (
    <div class="mx-auto mt-8 max-w-lg">
      <Show
        fallback={
          <div class="space-y-4">
            <h1 class="font-bold text-2xl">Mon profil</h1>
            <p>Vous n'êtes pas connecté.</p>
            <A class="btn btn-primary" href="/login">
              <LogIn />
              Se connecter
            </A>
          </div>
        }
        when={isLoggedIn()}
      >
        <h1 class="font-bold text-2xl">Mon profil</h1>
        <dl class="mt-4 space-y-2">
          <div class="flex gap-2">
            <dt class="w-24 text-neutral-500">Nom</dt>
            <dd>{user()?.name}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-24 text-neutral-500">Email</dt>
            <dd>{user()?.email}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-24 text-neutral-500">Club</dt>
            <dd>{club()?.name ?? '—'}</dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-24 text-neutral-500">Rôle</dt>
            <dd>{roleLabel()}</dd>
          </div>
        </dl>
        <button class="btn btn-outline mt-6" onClick={handleLogout} type="button">
          <LogOut />
          Se déconnecter
        </button>
      </Show>
    </div>
  )
}
