import type { JSXElement } from 'solid-js'

export type ScoringKey = '2pts' | '3pts' | 'free-throw'

export type StatMatchActionItemType = 'success' | 'error' | 'secondary'

export type StatMatchActionItemName =
  | '2pts'
  | '3pts'
  | 'free-throw'
  | 'offensive-rebond'
  | 'defensive-rebond'
  | 'assist'
  | 'foul'
  | 'turnover'
  | 'steals'
  | 'block'
  | 'fiveIn'
  | 'fiveOut'
  | 'gameStop'
  | 'gameStart'

export type StatMatchActionItem = {
  name: StatMatchActionItemName
  type: StatMatchActionItemType
  inGameAction: boolean
  opponentMatter: boolean
  value: number
  icon: () => JSXElement
  label1?: string | JSXElement
  label2?: string | JSXElement
  secondaryAction?: boolean
  everyTimeAction?: boolean
}

export type StatMatchSummaryRatio = {
  success: number
  fail: number
  total: number
  percentage: number
}

export type StatMatchSummaryPlayer = {
  playerId: string
  scores: Record<ScoringKey, number> & { total: number }
  rebonds: {
    defensive: number
    offensive: number
    total: number
  }
  ratio: Record<ScoringKey, StatMatchSummaryRatio>
  playTime: number | null
  nbPlayedMatch: number
  fouls: number
  assists: number
  steals: number
  turnover: number
  blocks: number
  eff: number
  astToRatio: number
  trueShootingPercentage: number
}

export type StatMatchSummaryRebonds = {
  teamTotal: number
  teamOffensive: number
  teamDefensive: number
  teamTotalPercentage: number
  teamOffensivePercentage: number
  teamDefensivePercentage: number
  opponentTotal: number
  opponentDefensive: number
  opponentOffensive: number
}

export type StatMatchSummary = {
  teamScore: number
  teamScores: StatMatchSummaryPlayer
  opponentScore: number
  opponentFouls: number
  players: Array<StatMatchSummaryPlayer>
  rebonds: StatMatchSummaryRebonds
  teamAssists?: number
  teamTurnover?: number
  teamFouls?: number
  teamSteals?: number
}
