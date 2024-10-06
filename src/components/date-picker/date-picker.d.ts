export type BsDatePickerOnChangeEvent = Event & {
  currentTarget: HTMLInputElement
  target: HTMLInputElement
}

export type BsDatePickerProps = {
  id?: string
  value?: string | null
  label?: string
  disabled?: boolean
  withTime?: boolean
  placeholder?: string | null
  onValueChange?: (value: string) => void
  onChange?: (value: string) => void
}
