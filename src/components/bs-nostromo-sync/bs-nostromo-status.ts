/**
 * Pure view mapping of the Nostromo sync UI: French labels and DaisyUI colour
 * variants per status, log timestamps, the wording of the failures a user can
 * act on, and the summaries of a restore plan and of its result.
 *
 * Nothing Solid and no store is imported here: the components stay
 * presentational and every function below is a plain lookup the tests can
 * assert on without rendering anything.
 */
import type { DaisyAlert } from '../../libs/daisy/daisy.d'
import { NostromoClientError } from '../../libs/nostromo/client'
import type { NostromoStatus } from '../../libs/nostromo/nostromo-sync-store.d'
import type { RemoteSnapshotDescription } from '../../libs/nostromo/remote-snapshot.d'
import type { NostromoRestoreDecision, NostromoRestorePlan, NostromoRestoreResult } from '../../libs/nostromo/restore.d'

/** Colour family of a status. The chip maps it to the DaisyUI classes. */
export type NostromoStatusVariant = 'error' | 'info' | 'neutral' | 'success' | 'warning'

/** `aria-label` of the status chip: it names the value, not the state of a panel. */
export const NOSTROMO_STATUS_CHIP_LABEL = 'État de synchronisation Nostromo'

/** Card heading, shared by the Administration card and the title of the restore modal. */
export const NOSTROMO_CARD_TITLE = 'Synchronisation Nostromo'

const MILLISECOND_MINUTE = 60_000
const MILLISECOND_HOUR = 3_600_000
const MILLISECOND_DAY = 86_400_000
// Hoisted to module scope: used by formatNostromoLogTime on every call.
const TIME_WITHOUT_SECONDS_PATTERN = /:\d{2}$/
// Hoisted to module scope: used by normalizeNostromoBaseUrl on every call.
const TRAILING_SLASHES_PATTERN = /\/+$/

/** French label of each status, shown by the chip and the log panel. */
export const NOSTROMO_STATUS_LABELS: Record<NostromoStatus, string> = {
  'auth-required': 'Reconnexion requise',
  conflict: 'Conflit',
  error: 'Erreur',
  off: 'Inactif',
  pending: 'En attente',
  saved: 'Synchronisé',
  saving: 'Sauvegarde…',
}

/** Colour of each status: green only when everything is pushed, red when the user must act. */
export const NOSTROMO_STATUS_VARIANTS: Record<NostromoStatus, NostromoStatusVariant> = {
  'auth-required': 'warning',
  conflict: 'error',
  error: 'error',
  off: 'neutral',
  pending: 'warning',
  saved: 'success',
  saving: 'info',
}

/**
 * Message toasted after the user asked for a synchronization (manual flush or
 * sign-in drain), keyed by the status the run left behind.
 */
export const NOSTROMO_FLUSH_MESSAGES: Record<NostromoStatus, string> = {
  'auth-required': 'Synchronisation refusée : reconnexion requise.',
  conflict: 'Conflit avec le serveur : résolvez-le depuis « Restaurer depuis Nostromo ».',
  error: 'La synchronisation a échoué : consultez le journal.',
  off: 'Synchronisation inactive.',
  pending: 'Synchronisation partielle : des données restent en attente.',
  saved: 'Synchronisation terminée.',
  saving: 'Synchronisation en cours…',
}

/** True while a push or a restore is in flight: the chip spins and the card disables its actions. */
export function isNostromoStatusBusy(status: NostromoStatus): boolean {
  return status === 'saving'
}

/** Maps a status colour to the alert palette of `toast`; `neutral` has no alert equivalent. */
export function toDaisyAlert(variant: NostromoStatusVariant): DaisyAlert {
  return variant === 'neutral' ? 'info' : variant
}

/** `1 unité appliquée` / `3 unités appliquées`: singular and plural are passed whole. */
function count(value: number, singular: string, plural: string): string {
  return `${value} ${value > 1 ? plural : singular}`
}

/** French local date and time of a capture: minutes precision, seconds omitted. */
export function formatNostromoSnapshotDate(at: number): string {
  const date = new Date(at)
  const time = date.toLocaleTimeString('fr-FR').replace(TIME_WITHOUT_SECONDS_PATTERN, '')
  return `${date.toLocaleDateString('fr-FR')} ${time}`
}

/** French one-line description of the stored snapshot, shown by the card entry. */
export function describeNostromoSnapshot(description: RemoteSnapshotDescription): string {
  return `Instantané serveur du ${formatNostromoSnapshotDate(description.createdAt)} (${description.reason})`
}

/**
 * French label of a log timestamp: relative while it is recent, the local date
 * beyond a day. `now` is injected so the tests never depend on the clock.
 */
export function formatNostromoLogTime(at: number, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - at)
  if (elapsed < MILLISECOND_MINUTE) {
    return "à l'instant"
  }
  if (elapsed < MILLISECOND_HOUR) {
    return `il y a ${Math.floor(elapsed / MILLISECOND_MINUTE)} min`
  }
  if (elapsed < MILLISECOND_DAY) {
    return `il y a ${Math.floor(elapsed / MILLISECOND_HOUR)} h`
  }

  const date = new Date(at)
  const time = date.toLocaleTimeString('fr-FR').replace(TIME_WITHOUT_SECONDS_PATTERN, '')
  return `${date.toLocaleDateString('fr-FR')} ${time}`
}

/** Trims a server address and drops its trailing slashes: the client concatenates paths verbatim. */
export function normalizeNostromoBaseUrl(value: string): string {
  return value.trim().replace(TRAILING_SLASHES_PATTERN, '')
}

/** True when the failure means the stored session is no longer accepted (HTTP 401). */
export function isNostromoAuthError(error: unknown): boolean {
  return error instanceof NostromoClientError && error.kind === 'auth'
}

/**
 * French banner text of the conflict status: the units the engine parked are
 * named, since resolving them is the only action the user has.
 *
 * The message stays truthful for every conflict, wipe or not: keeping the local
 * copy also keeps a recent deletion, and a second device can always bring its
 * own data back by pushing it again.
 */
export function describeNostromoConflict(units: readonly string[]): string {
  const base =
    'Des données locales sont en conflit avec le serveur. Garder la copie locale conservera aussi une suppression récente ; un autre appareil peut rétablir ses données en les renvoyant.'
  return units.length === 0 ? base : `${base} Éléments concernés : ${units.join(', ')}.`
}

/** French message of a refused sign-in, from the stable `kind` of the client error. */
export function describeNostromoAuthError(error: unknown): string {
  if (error instanceof NostromoClientError) {
    switch (error.kind) {
      case 'auth':
      case 'validation':
        return 'Identifiants invalides.'
      case 'network':
        return 'Serveur injoignable.'
      default:
        return 'Connexion au serveur impossible.'
    }
  }
  return 'Connexion au serveur impossible.'
}

/** French message of a failed restore, from the stable `kind` of the client error. */
export function describeNostromoRestoreError(error: unknown): string {
  if (error instanceof NostromoClientError) {
    switch (error.kind) {
      case 'auth':
        return 'Reconnexion requise.'
      case 'network':
        return 'Serveur injoignable.'
      case 'conflict':
        return 'Un conflit bloque la restauration.'
      default:
        return 'La restauration a échoué.'
    }
  }
  return 'La restauration a échoué.'
}

/** What a pull would write, broken down by kind: the modal title and the plan summary share it. */
function nostromoPlanChangeCounts(plan: NostromoRestorePlan): {
  collections: number
  deletions: number
  photos: number
} {
  return {
    collections: plan.collectionUnits.filter((unit) => unit.remotePayloadValid && unit.remote).length,
    deletions: plan.photoUnits.filter((unit) => unit.deletionRequired).length,
    photos: plan.photoUnits.filter((unit) => Boolean(unit.remote) && !unit.upToDate).length,
  }
}

/** Number of changes a pull would apply: the neutral title of the restore modal. */
export function countNostromoPlanChanges(plan: NostromoRestorePlan): number {
  const { collections, deletions, photos } = nostromoPlanChangeCounts(plan)
  return collections + photos + deletions
}

/** French summary of what a plan would write, shown above the warnings of the modal. */
export function describeNostromoPlan(plan: NostromoRestorePlan): string {
  const { collections, deletions, photos } = nostromoPlanChangeCounts(plan)
  const parts = [
    `${count(plan.remoteDocumentCount, 'document', 'documents')} sur le serveur`,
    `${count(collections, 'collection', 'collections')} et ${count(photos, 'photo', 'photos')} à reprendre`,
  ]

  if (deletions > 0) {
    parts.push(`${count(deletions, 'photo locale', 'photos locales')} sans copie serveur, à supprimer`)
  }

  return `${parts.join(', ')}.`
}

/** French summary of an apply run, toasted by the card once the run returns. */
export function describeNostromoRestoreResult(
  decision: NostromoRestoreDecision,
  result: NostromoRestoreResult
): string {
  const applied = count(result.appliedUnits.length, 'unité appliquée', 'unités appliquées')
  const trailing = describeRestoreTrailingCounts(result)

  if (decision === 'overwrite') {
    return `Écrasement du serveur terminé : ${count(result.appliedUnits.length, 'unité poussée', 'unités poussées')}${trailing}.`
  }

  return `Restauration terminée : ${applied}, ${count(result.deletedPhotoUnits.length, 'photo supprimée', 'photos supprimées')}${trailing}.`
}

/** `, 2 échecs, 1 unité ignorée`, or an empty string when nothing went wrong. */
function describeRestoreTrailingCounts(result: NostromoRestoreResult): string {
  const parts: string[] = []
  if (result.failedUnits.length > 0) {
    parts.push(count(result.failedUnits.length, 'échec', 'échecs'))
  }
  if (result.skippedUnits.length > 0) {
    parts.push(count(result.skippedUnits.length, 'unité ignorée', 'unités ignorées'))
  }
  return parts.length > 0 ? `, ${parts.join(', ')}` : ''
}
