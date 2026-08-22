import type { DaisySize } from '../../libs/daisy/daisy.d'

export type BsToggleOnChangeEvent = Event & {
  currentTarget: HTMLInputElement
  target: HTMLInputElement
}

export interface BsToggleProps {
  label?: string
  onChange?: (value: boolean) => void
  size?: DaisySize
  value?: boolean
}
