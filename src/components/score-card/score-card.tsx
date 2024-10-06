import { Show } from 'solid-js'
import { toDateTime } from '../../libs/utils'
import { BsMatchTypeBadge } from '../match-tile'
import type { BsScoreCardProps } from './score-card.d'

export default function BsScoreCard(props: BsScoreCardProps) {
  return (
    <div class="w-full grid grid-cols-5">
      <div class="col-span-2">
        <span class="countdown h-6 text-6xl inline-block w-full">
          <Show when={props.localScore >= 100}>
            <span
              class="text-end inline-block w-1/2"
              style={`--value:${Math.floor(props.localScore / 100)};`}
            />
            <span
              class="text-start inline-block w-1/2"
              style={`--value:${props.localScore - 100};`}
            />
          </Show>
          <Show when={props.localScore < 100}>
            <span
              class="text-center inline-block w-full"
              style={`--value:${props.localScore};`}
            />
          </Show>
        </span>
      </div>
      <div class="col-span-1">
        <div class="text-center text-xl w-full place-self-center">VS</div>
        <Show when={props.location}>
          <div class="text-center w-full place-self-center">
            <BsMatchTypeBadge type={props.location} size="sm" />
          </div>
        </Show>
        <Show when={props.date}>
          <div class="text-center w-full place-self-center">
            {toDateTime(props.date || null)}
          </div>
        </Show>
      </div>
      <div class="col-span-2">
        <span class="countdown h-6 text-6xl inline-block w-full">
          <Show when={props.visitorScore >= 100}>
            <span
              class="text-end inline-block w-1/2"
              style={`--value:${Math.floor(props.visitorScore / 100)};`}
            />
            <span
              class="text-start inline-block w-1/2"
              style={`--value:${props.visitorScore - 100};`}
            />
          </Show>
          <Show when={props.visitorScore < 100}>
            <span
              class="text-center inline-block w-full"
              style={`--value:${props.visitorScore};`}
            />
          </Show>
        </span>
      </div>
      <div class="col-span-2">
        <span class="text-xl inline-block w-full">
          <span class="text-center inline-block w-full">
            {props.localName || 'LOCAL'}
          </span>
        </span>
      </div>
      <div class="col-span-1">
        <span class="text-base" />
      </div>
      <div class="col-span-2">
        <span class="text-xl inline-block w-full">
          <span class="text-center inline-block w-full">
            {props.visitorName || 'VISITEUR'}
          </span>
        </span>
      </div>
    </div>
  )
}
