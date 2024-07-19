import { JSXElement, type JSX } from 'solid-js'
import {
  PrelineComponentSize,
  PrelineComponentVariant,
} from '../../libs/preline'

export type BsButtonProps = {
  children: JSXElement
  type?: 'button' | 'submit'
  slotStart?: JSXElement
  slotEnd?: JSXElement
  onClick?: () => void
  variant?: PrelineComponentVariant
  size?: PrelineComponentSize
  wide?: boolean
  pills?: boolean
  disabled?: boolean
} & JSX.HTMLAttributes<HTMLButtonElement>
