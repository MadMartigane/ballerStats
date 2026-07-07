import type { BsIconBaseProps } from './icon-base.d'

const DEFAULT_ICON_SIZE = 24

export default function BsIconBase(props: BsIconBaseProps) {
  const size = () => props.size ?? DEFAULT_ICON_SIZE

  return (
    <svg
      aria-label={props['aria-label']}
      class={props.class}
      fill="currentColor"
      height={size()}
      role="img"
      viewBox={props.viewBox}
      width={size()}
      xmlns="http://www.w3.org/2000/svg"
    >
      {props.children}
    </svg>
  )
}
