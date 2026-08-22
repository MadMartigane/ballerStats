import type { JSXElement } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'

export interface BsSelectDataSet {
  badge: JSXElement
  label: string
  value: string
}

export interface BsSelectMultipleProps {
  data?: BsSelectDataSet[]
  label?: string
  onChange?: (playerIds: string[]) => void
  placeholder?: string
  selectedIds?: string[]
}

export type BsSelectMultipleDataSelect = {
  placeholder: string
  selectId: string
  availables: BsSelectDataSet[]
  setAvailables: SetStoreFunction<BsSelectDataSet[]>
  disable?: boolean
} & BsSelectMultipleProps
