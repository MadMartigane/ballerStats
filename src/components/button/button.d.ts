import { JSXElement } from 'solid-js'
import {
  PrelineComponentSize,
  PrelineComponentVariant,
} from '../../libs/preline'

export type ButtonOptions = {
  slotStart?: JSXElement
  element: JSXElement
  slotEnd?: JSXElement
  onClick?: () => void
  variant?: PrelineComponentVariant
  size?: PrelineComponentSize
  wide?: boolean
  pills?: boolean
  disabled?: boolean
}
