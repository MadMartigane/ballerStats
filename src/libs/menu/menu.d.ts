import { JSXElement } from 'solid-js'

export type MenuEntry = {
  path: string
  label: string
  icon: () => JSXElement
  isMenuEntry: boolean
  component: () => JSXElement
}

