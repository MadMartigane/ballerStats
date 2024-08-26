import { Show } from 'solid-js'
import type { BsTileProps } from './tile.d'
import { Info } from 'lucide-solid'

export default function BsTile(options: BsTileProps) {
  return (
    <div class="card bg-neutral text-neutral-content min-w-80 max-w-80 w-80 shadow-lg shadow-neutral p-3">
        <div class="flex flex-row justify-between">
          <Show when={options.title}>
            <h2 class="card-title">{options.title}</h2>
          </Show>

          <Show when={options.badge}>
            <div class="text-4xl">{options.badge}</div>
          </Show>
        </div>

        <Show when={options.info}>
          <p class="my-2 flex flex-row gap-1 italic">
            <Info />
            <span class='inline-block mx-1'>{options.info}</span>
          </p>
        </Show>

        <Show when={options.body}>
          <div>{options.body}</div>
        </Show>

        <Show when={options.children}>
          <div>{options.children}</div>
        </Show>

        <Show when={options.footer}>
          <hr />
          <div class="card-actions justify-end">{options.footer}</div>
        </Show>
    </div>
  )
}
