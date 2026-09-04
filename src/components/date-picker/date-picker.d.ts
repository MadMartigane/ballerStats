export type BsDatePickerOnChangeEvent = Event & {
  currentTarget: HTMLInputElement
  target: HTMLInputElement
}

export interface BsDatePickerProps {
  disabled?: boolean
  id?: string
  label?: string
  onChange?: (value: string) => void
  onValueChange?: (value: string) => void
  placeholder?: string | null
  value?: string | null
  withTime?: boolean
}
