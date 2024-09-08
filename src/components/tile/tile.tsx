import { Show } from 'solid-js'
import type { BsTileProps } from './tile.d'
import { Info } from 'lucide-solid'

function onClick(
  callback?: (
    event?: MouseEvent & { currentTarget: HTMLDivElement; target: Element },
  ) => void,
) {
  if (callback) {
    callback()
  }
}

export default function BsTile(props: BsTileProps) {
  return (
    <div
      class={`${props.onClick ? 'cursor-pointer' : ''} card bg-neutral text-neutral-content min-w-80 max-w-80 w-80 shadow-lg shadow-neutral p-2`}
      onClick={() => {
        onClick(props.onClick)
      }}
    >
      <Show when={props.status}>
        <div>{props.status}</div>
      </Show>

      <div class="flex flex-row justify-between">
        <Show when={props.title}>
          <h2 class="card-title">{props.title}</h2>
        </Show>

        <Show when={props.badge}>
          <div class="text-4xl">{props.badge}</div>
        </Show>
      </div>

      <Show when={props.info}>
        <p class="my-2 flex flex-row gap-1 italic">
          <Info />
          <span class="inline-block mx-1">{props.info}</span>
        </p>
      </Show>

      <Show when={props.body}>
        <div>{props.body}</div>
      </Show>

      <Show when={props.children}>
        <div>{props.children}</div>
      </Show>

      <Show when={props.footer}>
        <hr />
        <div class="card-actions justify-end px-2">{props.footer}</div>
      </Show>
    </div>
  )
}
