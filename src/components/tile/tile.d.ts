import { JSXElement, type JSX } from 'solid-js'

export type BsTileProps = {
  children?: JSXElement
  title?: JSXElement
  badge?: JSXElement
  info?: JSXElement
  body?: JSXElement
  footer?: JSXElement
} & JSX.HTMLAttributes<HTMLButtonElement>
