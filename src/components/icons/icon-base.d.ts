import type { JSXElement } from 'solid-js'

export interface BsIconProps {
  /** Additional CSS classes forwarded to the root <svg>. */
  class?: string
  /** Width and height in pixels. Defaults to 24. */
  size?: number
}

export interface BsIconBaseProps extends BsIconProps {
  'aria-label': string
  children: JSXElement
  viewBox: string
}
