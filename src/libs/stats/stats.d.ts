import type { JSXElement } from 'solid-js'

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

export type StatMatchActionItem = {
  name: StatMatchActionItemName
  type: StatMatchActionItemType
  inGameAction: boolean
  value: number
  icon: JSXElement
  label1?: string | JSXElement
  label2?: string | JSXElement
}

export type StatMatchSummaryPlayer = {
  playerId: string
  scores: {
    'free-throw': number
    '2pts': number
    '3pts': number
    total: number
  }
  rebonds: {
    defensive: number
    offensive: number
    total: number
  }
  ratio: {
    'free-throw': {
      success: number
      fail: number
      total: number
      percentage: number
    }
    '2pts': {
      success: number
      fail: number
      total: number
      percentage: number
    }
    '3pts': {
      success: number
      fail: number
      total: number
      percentage: number
    }
  }
  fouls: number
  assists: number
  turnover: number
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
  opponentScore: number
  opponentFouls: number
  players: Array<StatMatchSummaryPlayer>
  rebonds: StatMatchSummaryRebonds
  teamAssists: number
  teamTurnover: number
  teamFouls: number
}
