import type { DaisySize } from '../../libs/daisy'

export type BsToggleOnChangeEvent = Event & {
  currentTarget: HTMLInputElement
  target: HTMLInputElement
}

export type BsToggleProps = {
  value?: boolean
  label?: string
  size?: DaisySize
  onChange?: (value: boolean) => void
}
