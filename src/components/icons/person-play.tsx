import type { BsIconProps } from './icons.d'
import { bsIconPropsToData } from './icons'


export default function BsIconPersonPlay(props: BsIconProps) {

  console.log("props: ", props)
  const data = bsIconPropsToData(props)
  console.log("data: ", data)

  return (
    <svg
      class={data.class}
      xmlns={data.xmlns}
      height={data.height}
      viewBox={data.viewBox}
      width={data.width}
    >
      <path d="M220-464 64-620l156-156 156 156-156 156ZM360-80v-200q-61-5-121-14.5T120-320l20-80q84 23 168.5 31.5T480-360q87 0 171.5-8.5T820-400l20 80q-59 16-119 25.5T600-280v200H360ZM220-576l44-44-44-44-44 44 44 44Zm260-104q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm0 280q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-360q17 0 28.5-11.5T520-800q0-17-11.5-28.5T480-840q-17 0-28.5 11.5T440-800q0 17 11.5 28.5T480-760Zm202 280-68-120 68-120h136l68 120-68 120H682Zm46-80h44l22-40-22-40h-44l-22 40 22 40Zm-508-60Zm260-180Zm270 200Z" />
    </svg>
  )
}
