import { Show } from 'solid-js'
import { CardComponentOptions } from './card.d'

export default function card(options: CardComponentOptions) {
  return (
    <div class="flex flex-col bg-white border shadow-sm rounded-xl dark:bg-neutral-900 dark:border-neutral-700 dark:shadow-neutral-700/70">
      <div class="p-4 md:p-7">
        <Show when={options.title}>
          <h3 class="text-lg font-bold text-gray-800 dark:text-white">
            {options.title}
          </h3>
        </Show>

        <Show when={options.info}>
          <p class="my-2 text-gray-500 dark:text-neutral-400">{options.info}</p>
        </Show>

        <Show when={options.body}>
          <div class="my-2 text-gray-600 dark:text-neutral-300">{options.body}</div>
        </Show>


        <Show when={options.footer}>
          <hr class="w-3/4 place-self-center my-2" />

          <div>{options.footer}</div>
        </Show>
      </div>
    </div>
  )
}
