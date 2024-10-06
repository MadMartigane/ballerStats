export type BsInputPropsType = 'text' | 'email'

export type BsInputOnChangeEvent = Event & {
  currentTarget: HTMLInputElement
  target: HTMLInputElement
}

export type BsInputProps = {
  id?: string
  type?: BsInputPropsType
  value?: string
  label?: string
  placeholder?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
}
