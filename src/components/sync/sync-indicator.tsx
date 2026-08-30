import { Cloud, CloudDownload, CloudOff, CloudUpload, RefreshCw, TriangleAlert, X } from 'lucide-solid'
import { createMemo, createSignal, Show } from 'solid-js'
import type { SyncStatus } from '../../libs/sync/sync.d'
import { firstSyncPending, lastSyncAt, syncManager, syncStatus } from '../../libs/sync/sync-manager'

const [isConflictModalOpen, setConflictModalOpen] = createSignal(false)

const STATUS_LABELS: Record<SyncStatus, string> = {
  conflict: 'Conflit initial — choisissez une option',
  error: 'Erreur de synchronisation',
  idle: 'Synchronisation inactive',
  offline: 'Hors ligne',
  pending: 'Modifications en attente de synchronisation',
  synced: 'Synchronisé',
  syncing: 'Synchronisation en cours…',
}

function SyncStatusIcon(props: { status: SyncStatus }) {
  if (props.status === 'syncing') {
    return <RefreshCw class="animate-spin" />
  }
  if (props.status === 'pending') {
    return <RefreshCw class="animate-pulse" />
  }
  if (props.status === 'offline') {
    return <CloudOff />
  }
  if (props.status === 'error') {
    return <TriangleAlert />
  }
  if (props.status === 'conflict') {
    return <RefreshCw class="animate-pulse" />
  }
  return <Cloud />
}

function handlePushLocal() {
  syncManager.resolveFirstSync('push-local')
}

function handlePullRemote() {
  syncManager.resolveFirstSync('pull-remote')
}

function handleCloseDialog() {
  setConflictModalOpen(false)
}

function FirstSyncDialog() {
  return (
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div class="modal-box w-full max-w-md">
        <h3 class="font-bold text-lg">Première synchronisation</h3>
        <p class="py-4">
          Des données existent à la fois sur cet appareil et sur le serveur du club. Que souhaitez-vous conserver ?
        </p>
        <div class="modal-action flex flex-col gap-2 sm:flex-row">
          <button class="btn btn-primary basis-1/2" onClick={handlePushLocal} type="button">
            <CloudUpload />
            Envoyer mes données
          </button>
          <button class="btn btn-secondary basis-1/2" onClick={handlePullRemote} type="button">
            <CloudDownload />
            Récupérer celles du serveur
          </button>
        </div>
        <p class="mt-2 text-neutral-500 text-xs">
          « Récupérer » télécharge d'abord une sauvegarde .bstat de vos données locales.
        </p>
        <button
          aria-label="Fermer"
          class="btn btn-square btn-sm absolute top-2 right-2"
          onClick={handleCloseDialog}
          type="button"
        >
          <X />
        </button>
      </div>
    </div>
  )
}

/** App-bar sync status indicator; click forces a sync, conflict opens the modal. */
export default function BsSyncIndicator() {
  const status = createMemo(() => syncStatus.get())
  const conflictPending = createMemo(() => firstSyncPending.get())
  const lastSync = createMemo(() => lastSyncAt.get())
  const label = createMemo(() => STATUS_LABELS[status()] ?? STATUS_LABELS.idle)

  function handleClick() {
    if (firstSyncPending.get()) {
      setConflictModalOpen(!isConflictModalOpen())
      return
    }
    syncManager.syncNow()
  }

  return (
    <>
      <div class="tooltip tooltip-bottom" data-tip={label()}>
        <button
          aria-label={label()}
          class="relative rounded-full bg-gray-800 p-1 text-gray-400 hover:text-white focus:outline-hidden focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
          onClick={handleClick}
          type="button"
        >
          <SyncStatusIcon status={status()} />
        </button>
      </div>
      <Show when={lastSync() !== null && !conflictPending()}>
        <span class="hidden text-gray-400 text-xs lg:inline">
          {new Date(lastSync() ?? 0).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      </Show>
      <Show when={conflictPending() && isConflictModalOpen()}>
        <FirstSyncDialog />
      </Show>
    </>
  )
}
