import { JSXElement } from 'solid-js'
import {
  PrelineComponentSize,
  PrelineComponentVariant,
} from '../../libs/preline'

export type ButtonOptions = {
  element: JSXElement
  onClick?: () => void
  variant?: PrelineComponentVariant
  size?: PrelineComponentSize
  wide?: boolean
  pills?: boolean
  disabled?: boolean
}
