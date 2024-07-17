import { JSXElement, type JSX } from 'solid-js'
import {
  PrelineComponentSize,
  PrelineComponentVariant,
} from '../../libs/preline'
import MadSignal from '../../libs/mad-signal'

export type BsButtonProps = {
  children: JSXElement
  slotStart?: JSXElement
  slotEnd?: JSXElement
  onClick?: () => void
  variant?: PrelineComponentVariant
  size?: PrelineComponentSize
  wide?: boolean
  pills?: boolean
  disabled?: boolean
} & JSX.HTMLAttributes<HTMLDivElement>
