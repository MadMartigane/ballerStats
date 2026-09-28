import type Match from '../../libs/match/match'
import type { MatchRawData } from '../../libs/match/match.d'
import type Player from '../../libs/player/player'

export interface BsPlayTimeEntryProps {
  match: Match
  onSaved: (raw: MatchRawData) => void
  roster: Player[]
}
