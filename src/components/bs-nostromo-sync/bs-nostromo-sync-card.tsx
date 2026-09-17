import { CloudDownload, LoaderCircle, LogIn, LogOut, RefreshCw, TriangleAlert } from 'lucide-solid'
import { createMemo, createSignal, createUniqueId, Show } from 'solid-js'
import { authWithPassword } from '../../libs/nostromo/client'
import { getNostromoBaseUrl } from '../../libs/nostromo/env'
import { clearConfig, getConfig, setConfig } from '../../libs/nostromo/nostromo-config-store'
import {
  getDirtyUnits,
  getNostromoLog,
  nostromoSync,
  pushNostromoLog,
  resetNostromoSyncData,
  setNostromoSyncStatus,
} from '../../libs/nostromo/nostromo-sync-store'
import { flushNostromoPush, getConflictedUnits } from '../../libs/nostromo/push-engine'
import { confirmNostromoRestore, planNostromoRestore } from '../../libs/nostromo/restore'
import type { NostromoRestoreDecision, NostromoRestorePlan } from '../../libs/nostromo/restore.d'
import { toast } from '../../libs/utils/utils'
import BsNostromoRestoreModal from './bs-nostromo-restore-modal'
import {
  describeNostromoAuthError,
  describeNostromoConflict,
  describeNostromoPlan,
  describeNostromoRestoreError,
  describeNostromoRestoreResult,
  formatNostromoLogTime,
  isNostromoAuthError,
  isNostromoStatusBusy,
  NOSTROMO_CARD_TITLE,
  NOSTROMO_FLUSH_MESSAGES,
  NOSTROMO_STATUS_VARIANTS,
  normalizeNostromoBaseUrl,
  toDaisyAlert,
} from './bs-nostromo-status'
import BsNostromoStatusChip from './bs-nostromo-status-chip'
import type { BsNostromoSyncCardProps } from './bs-nostromo-sync.d'

/** Stable `onInput` handler of a text field: JSX props never carry a fresh closure. */
function makeValueChangeHandler(setValue: (value: string) => void) {
  return (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    setValue(event.currentTarget.value)
  }
}

/**
 * Administration card of the Nostromo synchronization: the only adaptor of the
 * feature. It reads the sync stores, calls the sync libs and passes plain values
 * to the presentational chip, log and modal.
 *
 * Everything it writes goes through the libs: signing in stores a token-only
 * configuration, the manual save drains the outbox, and the restore always goes
 * through a plan the user confirms before anything is overwritten.
 */
export default function BsNostromoSyncCard(props: BsNostromoSyncCardProps) {
  const baseUrlId = createUniqueId()
  const emailId = createUniqueId()
  const passwordId = createUniqueId()

  const config = createMemo(() => getConfig())
  const status = () => nostromoSync.status
  const lastEntry = createMemo(() => getNostromoLog().at(-1))
  const conflictedUnits = createMemo(() => getConflictedUnits())

  const [baseUrl, setBaseUrl] = createSignal(getNostromoBaseUrl() ?? '')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [loginError, setLoginError] = createSignal('')
  const [loginBusy, setLoginBusy] = createSignal(false)
  const [flushBusy, setFlushBusy] = createSignal(false)
  const [restoreBusy, setRestoreBusy] = createSignal(false)
  const [plan, setPlan] = createSignal<NostromoRestorePlan | undefined>(undefined)

  const busy = () => loginBusy() || flushBusy() || restoreBusy() || isNostromoStatusBusy(status())
  const configured = () => Boolean(config())

  const onBaseUrlChange = makeValueChangeHandler(setBaseUrl)
  const onEmailChange = makeValueChangeHandler(setEmail)
  const onPasswordChange = makeValueChangeHandler(setPassword)

  /** Toast of the status a run left behind: the user always learns where the sync stands. */
  function reportStatus(): void {
    const current = status()
    toast(NOSTROMO_FLUSH_MESSAGES[current], toDaisyAlert(NOSTROMO_STATUS_VARIANTS[current]))
  }

  function reportSignInFailure(error: unknown): void {
    const message = describeNostromoAuthError(error)
    setLoginError(message)
    pushNostromoLog('error', `Connexion au serveur refusée : ${message}`)
  }

  function reportRestoreFailure(error: unknown): void {
    const message = describeNostromoRestoreError(error)
    if (isNostromoAuthError(error)) {
      setNostromoSyncStatus('auth-required')
    }
    pushNostromoLog('error', `Restauration refusée : ${message}`)
    toast(message, 'error')
  }

  /** Runs a background task and reports an unexpected rejection instead of dropping it. */
  function runDetached(run: Promise<void>, report: (error: unknown) => void): void {
    run.catch(report)
  }

  async function signIn(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    const target = normalizeNostromoBaseUrl(baseUrl())
    const identity = email().trim()
    const secret = password()

    if (target === '' || identity === '' || secret === '') {
      setLoginError("Renseignez l'adresse du serveur, l'email et le mot de passe.")
      return
    }

    setLoginError('')
    setLoginBusy(true)
    try {
      const { token, userId } = await authWithPassword(target, identity, secret)
      setConfig({ baseUrl: target, email: identity, token, userId })
      setPassword('')
      pushNostromoLog('info', `Connexion au serveur réussie (${identity}).`)
      // A queued change is now pushable: the drain below reports the real status.
      setNostromoSyncStatus(getDirtyUnits().length > 0 ? 'pending' : 'saved')
      await flushNostromoPush()
      reportStatus()
    } catch (error) {
      reportSignInFailure(error)
    } finally {
      setLoginBusy(false)
    }
  }

  function onSignInSubmit(event: SubmitEvent): void {
    runDetached(signIn(event), reportSignInFailure)
  }

  function signOut(): void {
    clearConfig()
    // Document ids are derived from the unit names alone: keeping the baselines
    // of the account that just left would make every push of the next one fail.
    // The reset also sets the status back to `off`.
    resetNostromoSyncData()
    pushNostromoLog(
      'info',
      'Déconnexion du serveur : la synchronisation est désactivée, les données locales sont conservées.'
    )
    toast('Déconnecté du serveur. Les données locales sont conservées.', 'info')
  }

  async function flushNow(): Promise<void> {
    setFlushBusy(true)
    try {
      pushNostromoLog('info', 'Sauvegarde manuelle demandée.')
      await flushNostromoPush()
      reportStatus()
    } catch {
      pushNostromoLog('error', 'Sauvegarde manuelle interrompue.')
    } finally {
      setFlushBusy(false)
    }
  }

  function onResolveConflict(): void {
    runDetached(openRestorePlan(true), reportRestoreFailure)
  }

  function onRequestRestore(): void {
    runDetached(openRestorePlan(false), reportRestoreFailure)
  }

  /** Reads the plan and either asks for a confirmation or applies the pull directly. */
  async function openRestorePlan(force: boolean): Promise<void> {
    setRestoreBusy(true)
    try {
      const nextPlan = await planNostromoRestore()
      pushNostromoLog('info', `Restauration : ${describeNostromoPlan(nextPlan)}`)
      if (force || nextPlan.requiresConfirmation) {
        setPlan(nextPlan)
        return
      }
      await runRestoreDecision(nextPlan, 'pull')
    } catch (error) {
      reportRestoreFailure(error)
    } finally {
      setRestoreBusy(false)
    }
  }

  /**
   * Runs the decision the user made after reading the plan. The modal stays open
   * until the run returns, so its busy state (disabled actions, spinner) is what
   * the user sees while the local state is being written.
   */
  async function runRestoreDecision(current: NostromoRestorePlan, decision: NostromoRestoreDecision): Promise<void> {
    if (decision === 'cancel') {
      setPlan(undefined)
      // `confirmNostromoRestore` logs the cancellation itself.
      await confirmNostromoRestore(current, decision)
      return
    }

    setRestoreBusy(true)
    try {
      const result = await confirmNostromoRestore(current, decision)
      if (result) {
        const failed = result.failedUnits.length > 0
        toast(describeNostromoRestoreResult(decision, result), failed ? 'warning' : 'success')
      }
    } catch (error) {
      reportRestoreFailure(error)
    } finally {
      setRestoreBusy(false)
      setPlan(undefined)
    }
  }

  function onRestoreDecision(decision: NostromoRestoreDecision): void {
    const current = plan()
    if (!current) {
      return
    }
    runDetached(runRestoreDecision(current, decision), reportRestoreFailure)
  }

  return (
    <div class="card bg-base-300 text-base-content">
      <div class="card-body">
        <h2 class="card-title my-2">{props.title ?? NOSTROMO_CARD_TITLE}</h2>

        <div class="flex flex-wrap items-center gap-2">
          <BsNostromoStatusChip status={status()} />
          <Show when={lastEntry()}>
            {(entry) => (
              <span class="min-w-0 truncate text-base-content/70 text-sm" title={entry().message}>
                {formatNostromoLogTime(entry().at)} : {entry().message}
              </span>
            )}
          </Show>
        </div>

        <Show when={status() === 'conflict'}>
          <div class="alert alert-error mt-2" role="alert">
            <TriangleAlert />
            <span>{describeNostromoConflict(conflictedUnits())}</span>
            <button class="btn btn-sm" disabled={busy()} onClick={onResolveConflict} type="button">
              <CloudDownload />
              Résoudre le conflit
            </button>
          </div>
        </Show>

        <Show when={!configured()}>
          <form class="mt-4 flex-col gap-3" onSubmit={onSignInSubmit}>
            <p class="text-base-content/70 text-sm">
              Connectez-vous au serveur Nostromo pour synchroniser les données entre plusieurs appareils.
            </p>

            <label class="w-full" for={baseUrlId}>
              Adresse du serveur
              <input
                class="input input-bordered mt-1 w-full"
                id={baseUrlId}
                onInput={onBaseUrlChange}
                type="url"
                value={baseUrl()}
              />
            </label>

            <label class="w-full" for={emailId}>
              Email
              <input
                autocomplete="username"
                class="input input-bordered mt-1 w-full"
                id={emailId}
                onInput={onEmailChange}
                type="email"
                value={email()}
              />
            </label>

            <label class="w-full" for={passwordId}>
              Mot de passe
              <input
                autocomplete="current-password"
                class="input input-bordered mt-1 w-full"
                id={passwordId}
                onInput={onPasswordChange}
                type="password"
                value={password()}
              />
            </label>

            <Show when={loginError() !== ''}>
              <p class="text-error text-sm" role="alert">
                {loginError()}
              </p>
            </Show>

            <div class="card-actions">
              <button class="btn btn-primary" disabled={loginBusy()} type="submit">
                <Show fallback={<LogIn />} when={loginBusy()}>
                  <LoaderCircle class="animate-spin" />
                </Show>
                Se connecter
              </button>
            </div>
          </form>
        </Show>

        <Show when={config()}>
          {(current) => (
            <div class="mt-4 flex-col gap-1 text-sm">
              <span>
                Connecté : <span class="break-all font-mono">{current().email}</span>
              </span>
              <span class="break-all">
                Serveur : <span class="font-mono">{current().baseUrl}</span>
              </span>
            </div>
          )}
        </Show>

        <div class="card-actions mt-4 flex-wrap gap-2">
          <button class="btn btn-primary" disabled={!configured() || busy()} onClick={flushNow} type="button">
            <Show fallback={<RefreshCw />} when={flushBusy()}>
              <LoaderCircle class="animate-spin" />
            </Show>
            Sauvegarder maintenant
          </button>

          <button class="btn btn-warning" disabled={!configured() || busy()} onClick={onRequestRestore} type="button">
            <Show fallback={<CloudDownload />} when={restoreBusy()}>
              <LoaderCircle class="animate-spin" />
            </Show>
            Restaurer depuis Nostromo
          </button>

          <Show when={configured()}>
            <button class="btn btn-outline" disabled={busy()} onClick={signOut} type="button">
              <LogOut />
              Se déconnecter
            </button>
          </Show>
        </div>

        <Show when={plan()}>
          {(current) => <BsNostromoRestoreModal busy={restoreBusy()} onDecision={onRestoreDecision} plan={current()} />}
        </Show>
      </div>
    </div>
  )
}
