import type { JSXElement } from 'solid-js'

export interface BsTileProps {
  badge?: JSXElement
  body?: JSXElement | JSXElement[]
  children?: JSXElement | JSXElement[]
  footer?: JSXElement | JSXElement[]
  header?: JSXElement
  info?: JSXElement
  onClick?: (event?: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => void
  status?: JSXElement
  title?: JSXElement
}
