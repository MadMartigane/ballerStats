import { Info } from 'lucide-solid'
import { children, Show } from 'solid-js'
import type { BsCardProps } from './card.d'

export default function BsCard(props: BsCardProps) {
  const title = children(() => props.title)
  const info = children(() => props.info)
  const body = children(() => props.body)
  const footer = children(() => props.footer)

  return (
    <div class="card bg-base-300 text-base-content">
      <div class="card-body">
        <Show when={title()}>
          <h2 class="card-title my-4">{title()}</h2>
        </Show>

        <Show when={info()}>
          <p class="my-4 flex flex-row gap-1 text-sm">
            <Info />
            {info()}
          </p>
        </Show>

        <Show when={body()}>
          <div class="my-4">{body()}</div>
        </Show>

        <Show when={footer()}>
          <hr />
          <div class="card-actions">{footer()}</div>
        </Show>
      </div>
    </div>
  )
}
