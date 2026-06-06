import { Show } from 'solid-js'
import { createRollingNumber } from '../../libs/rolling-number'
import { toDateTime } from '../../libs/utils'
import { BsMatchTypeBadge } from '../match-tile'
import type { BsScoreCardProps } from './score-card.d'

export default function BsScoreCard(props: BsScoreCardProps) {
  const localDisplay = createRollingNumber(() => props.localScore)
  const visitorDisplay = createRollingNumber(() => props.visitorScore)

  return (
    <div class="grid w-full grid-cols-5">
      <div class="col-span-2 text-center">
        <span class="inline-block font-mono text-6xl tabular-nums">{localDisplay()}</span>
      </div>
      <div class="col-span-1">
        <div class="w-full place-self-center text-center text-xl">VS</div>
        <Show when={props.location}>
          <div class="w-full place-self-center text-center">
            <BsMatchTypeBadge size="sm" type={props.location} />
          </div>
        </Show>
        <Show when={props.date}>
          <div class="w-full place-self-center text-center">{toDateTime(props.date || null)}</div>
        </Show>
      </div>
      <div class="col-span-2 text-center">
        <span class="inline-block font-mono text-6xl tabular-nums">{visitorDisplay()}</span>
      </div>
      <div class="col-span-2">
        <span class="inline-block w-full text-xl">
          <span class="inline-block w-full text-center">{props.localName || 'LOCAL'}</span>
        </span>
      </div>
      <div class="col-span-1">
        <span class="text-base" />
      </div>
      <div class="col-span-2">
        <span class="inline-block w-full text-xl">
          <span class="inline-block w-full text-center">{props.visitorName || 'VISITEUR'}</span>
        </span>
      </div>
    </div>
  )
}
