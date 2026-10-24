import { CloudDownload, CloudUpload, LoaderCircle, TriangleAlert } from 'lucide-solid'
import { createUniqueId, onMount, Show } from 'solid-js'
import type { BsNostromoOpenPullModalProps } from './bs-nostromo-sync.d'

/**
 * Modal of the open pull: the device holds changes the server never received, so
 * nothing is applied until the user chooses. Presentational only.
 */
export default function BsNostromoOpenPullModal(props: BsNostromoOpenPullModalProps) {
  const titleId = createUniqueId()

  // biome-ignore lint/suspicious/noUnassignedVariables: assigned by SolidJS ref prop
  let dialogEl: HTMLDialogElement | undefined

  onMount(() => {
    dialogEl?.focus()
  })

  return (
    <dialog aria-labelledby={titleId} class="modal modal-middle" open ref={dialogEl}>
      <div class="modal-box max-h-[calc(100dvh-4rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto">
        <h3 class="flex items-center gap-2 font-bold text-lg" id={titleId}>
          <TriangleAlert />
          Modifications non synchronisées
        </h3>
        <p class="mt-4 text-sm">
          Cet appareil contient des modifications qui n'ont pas pu être envoyées au serveur. Que voulez-vous faire ?
        </p>
        <p class="mt-2 text-sm opacity-70">Collections concernées : {props.units.join(', ')}</p>

        <div class="mt-4 flex flex-wrap gap-2">
          <button class="btn btn-primary btn-sm" disabled={props.busy} onClick={props.onRetry} type="button">
            <CloudUpload />
            Envoyer d'abord (réessayer)
          </button>
          <button class="btn btn-warning btn-sm" disabled={props.busy} onClick={props.onKeepLocal} type="button">
            Garder mes données
          </button>
          <button class="btn btn-error btn-sm" disabled={props.busy} onClick={props.onTakeServer} type="button">
            <CloudDownload />
            Prendre celles du serveur
          </button>
        </div>

        <Show when={props.busy}>
          <p class="mt-3 flex items-center gap-2 text-sm">
            <LoaderCircle class="animate-spin" size={16} />
            Traitement en cours…
          </p>
        </Show>
      </div>
    </dialog>
  )
}
