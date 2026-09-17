import { For, Show } from 'solid-js'
import type { NostromoLogLevel } from '../../libs/nostromo/nostromo-sync-store.d'
import { formatNostromoLogTime } from './bs-nostromo-status'
import type { BsNostromoLogMenuProps } from './bs-nostromo-sync.d'

/** Colour of a log level, readable on the dark panel of the app bar. */
const LEVEL_CLASSES: Record<NostromoLogLevel, string> = {
  error: 'text-error',
  info: 'text-slate-300',
  warn: 'text-warning',
}

export default function BsNostromoLogMenu(props: BsNostromoLogMenuProps) {
  const followAdministration = () => props.onNavigate?.()

  return (
    <ul
      aria-label="Journal de synchronisation Nostromo"
      class="absolute right-0 z-10 mt-2 max-h-80 w-80 max-w-[calc(100vw-2rem)] origin-top-right overflow-y-auto rounded-md bg-slate-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-hidden"
    >
      <Show
        fallback={<li class="px-3 py-2 text-slate-300 text-sm">Aucune activité de synchronisation.</li>}
        when={props.entries.length > 0}
      >
        <For each={props.entries}>
          {(entry) => (
            <li class="flex flex-row gap-2 px-3 py-1 text-xs">
              <span class="shrink-0 text-slate-400">{formatNostromoLogTime(entry.at)}</span>
              <span class={`min-w-0 break-words ${LEVEL_CLASSES[entry.level]}`}>{entry.message}</span>
            </li>
          )}
        </For>
      </Show>

      <li>
        <a
          class="mt-1 block border-slate-700 border-t px-3 py-2 font-medium text-base text-slate-100 hover:bg-slate-700 hover:text-white"
          href="/"
          onClick={followAdministration}
        >
          Administration
        </a>
      </li>
    </ul>
  )
}
