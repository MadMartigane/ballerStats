import { Show } from 'solid-js'
import { toDateTime } from '../../libs/utils'
import { BsMatchTypeBadge } from '../match-tile'
import type { BsScoreCardProps } from './score-card.d'

export default function BsScoreCard(props: BsScoreCardProps) {
  return (
    <div class="grid w-full grid-cols-5">
      <div class="col-span-2">
        <span class="countdown inline-block h-6 w-full text-6xl">
          <Show when={props.localScore >= 100}>
            <span class="inline-block w-1/2 text-end" style={`--value:${Math.floor(props.localScore / 100)};`} />
            <span class="inline-block w-1/2 text-start" style={`--value:${props.localScore - 100};`} />
          </Show>
          <Show when={props.localScore < 100}>
            <span class="inline-block w-full text-center" style={`--value:${props.localScore};`} />
          </Show>
        </span>
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
      <div class="col-span-2">
        <span class="countdown inline-block h-6 w-full text-6xl">
          <Show when={props.visitorScore >= 100}>
            <span class="inline-block w-1/2 text-end" style={`--value:${Math.floor(props.visitorScore / 100)};`} />
            <span class="inline-block w-1/2 text-start" style={`--value:${props.visitorScore - 100};`} />
          </Show>
          <Show when={props.visitorScore < 100}>
            <span class="inline-block w-full text-center" style={`--value:${props.visitorScore};`} />
          </Show>
        </span>
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
