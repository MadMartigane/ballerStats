import { Show } from 'solid-js'
import { BsCardProps } from './card.d'
import { Info } from 'lucide-solid'

export default function BsCard(options: BsCardProps) {
  return (
    <div class="flex flex-col bg-white border shadow-sm rounded-xl dark:bg-neutral-900 dark:border-neutral-700 dark:shadow-neutral-700/70">
      <div class="p-4 md:p-7">
        <Show when={options.title}>
          <h3 class="my-4 text-lg font-bold text-gray-800 dark:text-white">
            {options.title}
          </h3>
        </Show>

        <Show when={options.info}>
          <p class="my-4 flex flex-row gap-1 text-sm text-b-500 dark:text-blue-300"><Info />{options.info}</p>
        </Show>

        <Show when={options.body}>
          <div class="my-4 text-gray-600 dark:text-neutral-300">{options.body}</div>
        </Show>


        <Show when={options.footer}>
          <hr />

          <div>{options.footer}</div>
        </Show>
      </div>
    </div>
  )
}
