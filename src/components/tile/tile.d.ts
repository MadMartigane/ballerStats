import type { JSXElement } from 'solid-js'

export type BsTileProps = {
  children?: JSXElement | Array<JSXElement>
  title?: JSXElement
  badge?: JSXElement
  status?: JSXElement
  info?: JSXElement
  body?: JSXElement | Array<JSXElement>
  footer?: JSXElement | Array<JSXElement>
  onClick?: (
    event?: MouseEvent & { currentTarget: HTMLDivElement; target: Element },
  ) => void
}
