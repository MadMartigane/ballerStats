import type { JSXElement } from 'solid-js'

export interface MenuEntry {
  component: () => JSXElement
  icon: () => JSXElement
  isMenuEntry: boolean
  label: string
  path: string
}
