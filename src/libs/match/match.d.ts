export type MatchType = 'home' | 'outside'

export type MatchRawData = {
  id?: string
  opponent?: string | null
  type?: MatchType
  teamId?: string | null
}
