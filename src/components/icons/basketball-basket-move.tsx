import { bsIconPropsToDataStore } from './icons'
import type { BsIconProps } from './icons.d'

export default function BsIconBasketballBasketMove(props: BsIconProps) {
  const data = bsIconPropsToDataStore(props)

  return (
    <svg
      role="img"
      aria-label="Basketball basket move"
      viewBox="0 0 256 256"
      data-name="Layer 1"
      id="Layer_1"
      xmlns="http://www.w3.org/2000/svg"
      width={data.width}
      height={data.height}
      fill={data.fill}
    >
      <defs>
        <style>{`.cls-1{fill:none;stroke:${data.fill};stroke-miterlimit:10;stroke-width:8px;}`}</style>
      </defs>
      <title />
      <rect class="cls-1" height="181.21" width="240" x="8" y="37.4" />
      <rect class="cls-1" height="24.42" width="79.51" x="30.24" y="63.33" />
      <line class="cls-1" x1="58" x2="81" y1="76" y2="76" />
      <polyline class="cls-1" points="27 119 59 119 59 185 27 185" />
      <line class="cls-1" x1="27" x2="59" y1="152" y2="152" />
      <polyline class="cls-1" points="76 119 108 119 108 152 80 152 80 185 112 185" />
      <rect class="cls-1" height="24.42" width="79.51" x="149.24" y="63.33" />
      <line class="cls-1" x1="177" x2="200" y1="76" y2="76" />
      <polyline class="cls-1" points="146 119 178 119 178 185 146 185" />
      <line class="cls-1" x1="146" x2="178" y1="152" y2="152" />
      <rect class="cls-1" height="66" width="33" x="195" y="119" />
      <line class="cls-1" x1="128" x2="128" y1="133" y2="141" />
      <line class="cls-1" x1="128" x2="128" y1="165" y2="173" />
    </svg>
  )
}
