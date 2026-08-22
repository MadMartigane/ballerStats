import { HelpCircle, X } from 'lucide-solid'
import { createSignal, createUniqueId, For, Show } from 'solid-js'
import { type ColumnWithGlossary, GLOSSARY_COLUMNS } from './stat-columns'

function makeLegendEntryClickHandler(
  setSelectedEntry: (entry: ColumnWithGlossary | null) => void,
  getDialog: () => HTMLDialogElement | undefined
) {
  return (event: MouseEvent) => {
    const { columnId } = (event.currentTarget as HTMLElement).dataset
    const entry = GLOSSARY_COLUMNS.find((candidate) => candidate.id === columnId)
    if (!entry) {
      return
    }
    setSelectedEntry(entry)
    const dialog = getDialog()
    if (!dialog?.open) {
      dialog?.showModal()
    }
  }
}

function makeClearSelectedEntryHandler(setSelectedEntry: (entry: ColumnWithGlossary | null) => void) {
  return () => {
    setSelectedEntry(null)
  }
}

function makeDialogCloseHandler(getDialog: () => HTMLDialogElement | undefined) {
  return () => {
    getDialog()?.close()
  }
}

function makeBackdropClickHandler(getDialog: () => HTMLDialogElement | undefined) {
  return (event: MouseEvent) => {
    if (event.target === getDialog()) {
      getDialog()?.close()
    }
  }
}

export function BsStatsLegend() {
  const titleId = createUniqueId()
  const [selectedEntry, setSelectedEntry] = createSignal<ColumnWithGlossary | null>(null)

  // biome-ignore lint/suspicious/noUnassignedVariables: assigned by SolidJS ref prop
  let dialogEl: HTMLDialogElement | undefined

  return (
    <div class="mt-2">
      <ul class="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
        <For each={GLOSSARY_COLUMNS}>
          {(entry) => (
            <li class="flex items-center justify-between gap-2 rounded-xs px-2 py-1 odd:bg-base-200">
              <span class="whitespace-nowrap font-mono font-semibold">{entry.label}</span>
              <span class="flex-1 truncate text-base-content/80">{entry.glossary.fullName}</span>
              {entry.glossary.explanation && (
                <button
                  aria-label={`En savoir plus sur ${entry.glossary.fullName}`}
                  class="btn btn-xs btn-ghost print:hidden"
                  data-column-id={entry.id}
                  onClick={makeLegendEntryClickHandler(setSelectedEntry, () => dialogEl)}
                  type="button"
                >
                  <HelpCircle />
                  En savoir plus
                </button>
              )}
            </li>
          )}
        </For>
      </ul>

      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: <dialog> is a native interactive element */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: <dialog> handles Escape natively and the click only dismisses on backdrop */}
      <dialog
        aria-labelledby={titleId}
        class="modal modal-bottom sm:modal-middle"
        onClick={makeBackdropClickHandler(() => dialogEl)}
        onClose={makeClearSelectedEntryHandler(setSelectedEntry)}
        ref={dialogEl}
      >
        <div class="modal-box">
          <Show when={selectedEntry()}>
            {(entry) => {
              const glossaryEntry = entry()
              return (
                <>
                  <div class="flex items-center justify-between">
                    <h2 class="font-bold text-lg" id={titleId} tabIndex={-1}>
                      {glossaryEntry.glossary.fullName}
                    </h2>
                    <button
                      aria-label="Fermer"
                      class="btn btn-square btn-sm"
                      onClick={makeDialogCloseHandler(() => dialogEl)}
                      type="button"
                    >
                      <X />
                    </button>
                  </div>

                  <p class="mt-4">{glossaryEntry.glossary.explanation}</p>
                </>
              )
            }}
          </Show>

          <div class="modal-action">
            <button class="btn btn-primary" onClick={makeDialogCloseHandler(() => dialogEl)} type="button">
              Fermer
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
