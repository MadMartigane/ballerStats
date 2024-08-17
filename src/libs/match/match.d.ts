export type MatchType = 'home' | 'outside'

export type MatchRawData = {
  id?: number
  opponent?: string | null
  type?: MatchType
  teamId?: number | null
}
