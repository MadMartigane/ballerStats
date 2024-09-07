import { JSXElement } from 'solid-js'
import { DaisyVariant } from '../daisy'

export type MenuEntry = {
  path: string
  label: string
  icon: (variant?: DaisyVariant) => JSXElement
  isMenuEntry: boolean
  component: () => JSXElement
}

