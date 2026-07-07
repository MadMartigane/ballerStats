import type { JSXElement } from 'solid-js'

export interface BsIconProps {
  /** Width and height in pixels. Defaults to 24. */
  size?: number
  /** Additional CSS classes forwarded to the root <svg>. */
  class?: string
}

export interface BsIconBaseProps extends BsIconProps {
  'aria-label': string
  viewBox: string
  children: JSXElement
}
