import { Show } from 'solid-js'
import { BsScoreCardProps } from './score-card.d'

export default function BsScoreCard(props: BsScoreCardProps) {
  return (
    <div class="w-full grid grid-cols-5">
      <div class="col-span-2">
        <span class="countdown h-6 text-6xl inline-block w-full">
          <Show when={props.localScore >= 100}>
            <span
              class="text-end inline-block w-1/2"
              style={`--value:${Math.floor(props.localScore / 100)};`}
            ></span>
            <span
              class="text-start inline-block w-1/2"
              style={`--value:${props.localScore - 100};`}
            ></span>
          </Show>
          <Show when={props.localScore < 100}>
            <span
              class="text-center inline-block w-full"
              style={`--value:${props.localScore};`}
            ></span>
          </Show>
        </span>
      </div>
      <div class="col-span-1">
        <span class="text-center text-xl inline-block w-full place-self-center">VS</span>
      </div>
      <div class="col-span-2">
        <span class="countdown h-6 text-6xl inline-block w-full">
          <Show when={props.visitorScore >= 100}>
            <span
              class="text-end inline-block w-1/2"
              style={`--value:${Math.floor(props.visitorScore / 100)};`}
            ></span>
            <span
              class="text-start inline-block w-1/2"
              style={`--value:${props.visitorScore - 100};`}
            ></span>
          </Show>
          <Show when={props.visitorScore < 100}>
            <span
              class="text-center inline-block w-full"
              style={`--value:${props.visitorScore};`}
            ></span>
          </Show>
        </span>
      </div>
      <div class="col-span-2">
        <span class="text-xl inline-block w-full">
          <span class="text-center inline-block w-full">LOCAL</span>
        </span>
      </div>
      <div class="col-span-1">
        <span class="text-base"></span>
      </div>
      <div class="col-span-2">
        <span class="text-xl inline-block w-full">
          <span class="text-center inline-block w-full">VISITEUR</span>
        </span>
      </div>
    </div>
  )
}