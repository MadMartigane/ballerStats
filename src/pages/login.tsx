import { LogIn } from 'lucide-solid'
import { createSignal, Show } from 'solid-js'
import { authLoading, login } from '../libs/auth/auth'
import { isAuthEnabled } from '../libs/pocketbase/client'
import { goTo, toast } from '../libs/utils/utils'

export default function Login() {
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')

  const handleEmailInput = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    setEmail(event.currentTarget.value)
  }
  const handlePasswordInput = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    setPassword(event.currentTarget.value)
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    try {
      await login(email(), password())
      toast('Connexion réussie', 'success')
      goTo('/')
    } catch (err) {
      toast(`Connexion impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}`, 'error')
    }
  }

  return (
    <div class="mx-auto mt-8 w-full max-w-md">
      <h1 class="font-bold text-2xl">Connexion</h1>

      <Show fallback={<p class="mt-4">La connexion est indisponible dans cette configuration.</p>} when={isAuthEnabled}>
        <form class="mt-4 space-y-4" onsubmit={handleSubmit}>
          <label class="form-control w-full">
            <span class="label">Email</span>
            <input
              autocomplete="email"
              class="input input-bordered w-full"
              onInput={handleEmailInput}
              type="email"
              value={email()}
            />
          </label>

          <label class="form-control w-full">
            <span class="label">Mot de passe</span>
            <input
              autocomplete="current-password"
              class="input input-bordered w-full"
              onInput={handlePasswordInput}
              type="password"
              value={password()}
            />
          </label>

          <button class="btn btn-primary w-full" disabled={authLoading.get() || !email() || !password()} type="submit">
            <LogIn />
            {authLoading.get() ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </Show>
    </div>
  )
}
