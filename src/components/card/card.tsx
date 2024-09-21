import { Info } from 'lucide-solid';
import { Show } from 'solid-js';
import type { BsCardProps } from './card.d';

export default function BsCard(options: BsCardProps) {
  return (
    <div class="card bg-base-300 text-base-content">
      <div class="card-body">
        <Show when={options.title}>
          <h2 class="my-4 card-title">{options.title}</h2>
        </Show>

        <Show when={options.info}>
          <p class="my-4 flex flex-row gap-1 text-sm">
            <Info />
            {options.info}
          </p>
        </Show>

        <Show when={options.body}>
          <div class="my-4">{options.body}</div>
        </Show>

        <Show when={options.footer}>
          <hr />
          <div class="card-actions justify-center">{options.footer}</div>
        </Show>
      </div>
    </div>
  );
}
