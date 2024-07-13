export type InputComponentOptionsType = 'text' | 'email'

export type InputComponentOnChangeEvent = Event & { currentTarget: HTMLInputElement; target: HTMLInputElement; }

export type InputComponentOptions = {
  id?: string
  type?: InputComponentOptionsType
  value?: string
  label?: string
  placeholder?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
}
