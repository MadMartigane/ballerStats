import Player from '../../libs/player'

export type BsSelectMultipleProps = {
  label?: string
  placeholder?: string
  players?: Player[]
  selectedPlayerIds?: number[]
  onChange?: (playerIds: number[]) => void
}

export type BsSelectMultipleDataSelect = {
  placeholder: string
  selectId: string
  availablePlayers: Player[]
} & BsSelectMultipleProps