import type { JSXElement } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'

export type BsSelectDataSet = {
  value: string
  label: string
  badge: JSXElement
}

export type BsSelectMultipleProps = {
  label?: string
  placeholder?: string
  data?: BsSelectDataSet[]
  selectedIds?: string[]
  onChange?: (playerIds: string[]) => void
}

export type BsSelectMultipleDataSelect = {
  placeholder: string
  selectId: string
  availables: BsSelectDataSet[]
  setAvailables: SetStoreFunction<BsSelectDataSet[]>
  disable?: boolean
} & BsSelectMultipleProps
