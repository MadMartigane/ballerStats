import { Info } from 'lucide-solid'
import { Show } from 'solid-js'
import type { BsTileProps } from './tile.d'

function onClick(callback?: (event?: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => void) {
  if (callback) {
    callback()
  }
}

function makeTileClickHandler(callback: BsTileProps['onClick']) {
  return () => {
    onClick(callback)
  }
}

function makeTileKeyDownHandler(callback: BsTileProps['onClick']) {
  return (event: KeyboardEvent) => {
    if (event.code === 'enter') {
      onClick(callback)
    }
  }
}

export default function BsTile(props: BsTileProps) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: tile is a legacy clickable card, preserved per audit finding P1-1
    // biome-ignore lint/a11y/noStaticElementInteractions: tile is a legacy clickable card, preserved per audit finding P1-1
    <div
      class={`${props.onClick ? 'cursor-pointer' : ''} card w-80 min-w-80 max-w-80 bg-neutral p-2 text-neutral-content shadow-lg shadow-neutral`}
      onClick={makeTileClickHandler(props.onClick)}
      onKeyDown={makeTileKeyDownHandler(props.onClick)}
    >
      <Show when={props.header}>
        <div class="flex justify-center py-2">{props.header}</div>
      </Show>
      <Show when={props.status}>
        <div>{props.status}</div>
      </Show>

      <div class="flex min-w-0 flex-row justify-between">
        <Show when={props.title}>
          <h2
            class="card-title line-clamp-2 min-w-0 break-words"
            title={typeof props.title === 'string' ? props.title : undefined}
          >
            {props.title}
          </h2>
        </Show>

        <Show when={props.badge}>
          <div class="flex-none text-4xl">{props.badge}</div>
        </Show>
      </div>

      <Show when={props.info}>
        <p class="my-2 flex flex-row gap-1 italic">
          <Info />
          <span class="mx-1 inline-block min-w-0 break-words">{props.info}</span>
        </p>
      </Show>

      <Show when={props.body}>
        <div>{props.body}</div>
      </Show>

      <Show when={props.children}>
        <div class="line-clamp-2 min-w-0 break-words">{props.children}</div>
      </Show>

      <Show when={props.footer}>
        <hr />
        <div class="card-actions justify-end px-2">{props.footer}</div>
      </Show>
    </div>
  )
}
