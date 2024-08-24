import { JSXElement, type JSX } from 'solid-js'

export type BsTileProps = {
  children?: JSXElement | Array<JSXElement>
  title?: JSXElement
  badge?: JSXElement
  info?: JSXElement
  body?: JSXElement | Array<JSXElement>
  footer?: JSXElement | Array<JSXElement>
} & JSX.HTMLAttributes<HTMLDivElement>
