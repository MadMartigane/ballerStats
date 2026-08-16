export interface BsComboboxProps {
  id?: string
  label?: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  value: string
}
