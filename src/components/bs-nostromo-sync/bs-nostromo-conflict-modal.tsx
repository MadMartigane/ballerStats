import { CloudDownload, CloudUpload, LoaderCircle, TriangleAlert, X } from 'lucide-solid'
import { createUniqueId, For, onMount, Show } from 'solid-js'
import type { ConflictChoice } from '../../libs/nostromo/conflict-resolution'
import type { BsNostromoConflictModalProps } from './bs-nostromo-sync.d'

/**
 * Per-unit conflict modal: lists the parked collections with one decision each.
 * Presentational only: the parent runs the confirmation and the resolution.
 */
export default function BsNostromoConflictModal(props: BsNostromoConflictModalProps) {
  const titleId = createUniqueId()

  // biome-ignore lint/suspicious/noUnassignedVariables: assigned by SolidJS ref prop
  let dialogEl: HTMLDialogElement | undefined

  onMount(() => {
    dialogEl?.focus()
  })

  const resolveWith = (unit: string, choice: ConflictChoice) => () => props.onResolve(unit, choice)

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !props.busy) {
      props.onClose()
    }
  }

  return (
    <dialog aria-labelledby={titleId} class="modal modal-middle" onKeyDown={onKeyDown} open ref={dialogEl}>
      <div class="modal-box max-h-[calc(100dvh-4rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto">
        <div class="flex items-start justify-between gap-2">
          <h3 class="flex items-center gap-2 font-bold text-lg" id={titleId}>
            <TriangleAlert />
            Conflit de synchronisation
          </h3>
          <button
            aria-label="Fermer"
            class="btn btn-square btn-sm"
            disabled={props.busy}
            onClick={props.onClose}
            type="button"
          >
            <X />
          </button>
        </div>

        <ul class="mt-4 space-y-4">
          <For each={props.units}>
            {(unit) => (
              <li class="space-y-2">
                <p class="text-sm">
                  La copie du serveur a changé pendant que vous modifiiez cet élément sur cet appareil. Le conflit porte
                  sur toute la collection « {unit} ».
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    class="btn btn-warning btn-sm"
                    disabled={props.busy}
                    onClick={resolveWith(unit, 'keep-local')}
                    type="button"
                  >
                    <CloudUpload />
                    Garder mes données
                  </button>
                  <button
                    class="btn btn-error btn-sm"
                    disabled={props.busy}
                    onClick={resolveWith(unit, 'take-server')}
                    type="button"
                  >
                    <CloudDownload />
                    Prendre celles du serveur
                  </button>
                </div>
              </li>
            )}
          </For>
        </ul>

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
