export type InputComponentOptionsType = 'text' | 'email'

export type InputComponentOptions = {
  type: InputComponentOptionsType
  value?: string
  label?: string
  placeholder?: string
  onChange?: () => string
}
