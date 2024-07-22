import Player from '../../libs/player'

export type BsSelectMultipleProps = {
  placeholder?: string
  players: Player[]
  selectedPlayerIds?: number[]
  onChange: (playerIds: number[]) => void
}

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
