export type BsInputPropsType = 'text' | 'email'

export type BsInputOnChangeEvent = Event & {
  currentTarget: HTMLInputElement
  target: HTMLInputElement
}

export interface BsInputProps {
  disabled?: boolean
  id?: string
  label?: string
  maxLength?: number
  onBlur?: () => void
  onChange?: (value: string) => void
  onFocus?: () => void
  placeholder?: string
  type?: BsInputPropsType
  value?: string
}
