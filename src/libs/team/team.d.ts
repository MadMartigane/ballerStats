import type { AgeCategory, MatchFormatConfig } from './match-format'

export interface TeamRawData {
  category?: AgeCategory | null
  clubId?: string
  id?: string
  matchFormat?: MatchFormatConfig | null
  name?: string | null
  playerIds?: string[]
}
