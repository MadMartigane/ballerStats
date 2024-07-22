import { JSX } from 'solid-js'

export type BsSelectMultipleProps = {
  placeholder?: string
} & JSX.HTMLAttributes<HTMLSelectElement>

export type BsSelectMultipleDataSelect = {
  mode: string
  placeholder: string
  toggleTag: string
  toggleClasses: string
  dropdownClasses: string
  optionClasses: string
  optionTemplate: string
  extraMarkup: string
  tagsItemTemplate: string
  tagsInputClasses: string
  wrapperClasses: string
}
