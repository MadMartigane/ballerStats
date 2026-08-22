import type { JSX, JSXElement } from 'solid-js'

export type BsSelectOnChangeEvent = Event & {
  currentTarget: HTMLSelectElement
  target: HTMLSelectElement
}
export interface BsSelectData {
  label?: string | JSXElement
  value: string
}

export type BsSelectProps = {
  id?: string
  value?: string | null
  datas: BsSelectData[]
  label?: string
  disabled?: boolean
  default?: string | null
  placeholder?: string | null
  onValueChange?: (value: string) => void
  onChange?: (
    event: Event & {
      currentTarget: HTMLSelectElement
      target: HTMLSelectElement
    }
  ) => void
} & JSX.HTMLAttributes<HTMLSelectElement>
