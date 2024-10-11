import type { JSXElement } from 'solid-js'
import type { DaisySize, DaisyVariant } from '../daisy'

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
  icon: (variant?: DaisyVariant, size?: DaisySize) => JSXElement
  label1?: string | JSXElement
  label2?: string | JSXElement
  secondaryAction?: boolean
  everyTimeAction?: boolean
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
  playTime: number | null
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
  teamScores: StatMatchSummaryPlayer
  opponentScore: number
  opponentFouls: number
  players: Array<StatMatchSummaryPlayer>
  rebonds: StatMatchSummaryRebonds
  teamAssists: number
  teamTurnover: number
  teamFouls: number
}
