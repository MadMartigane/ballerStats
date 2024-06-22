import { JSXElement } from 'solid-js'
import AppBarEl from './app-bar'

export type AppBarMenuEntry = {
  path: string
  label: string
  icon: () => JSXElement
  isMenuEntry: boolean
  component: () => JSXElement
}

export default AppBarEl

