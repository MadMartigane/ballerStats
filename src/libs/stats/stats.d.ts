import { JSXElement } from 'solid-js'

export type StatMatchActionItemType = 'success' | 'error'

export type StatMatchActionItemName =
  | '2pts'
  | '3pts'
  | 'free-throw'
  | 'offensive-rebond'
  | 'defensive-rebond'
  | 'assist'
  | 'foul'

export type StatMatchActionItem = {
  name: StatMatchActionItemName
  type: StatMatchActionItemType
  value: number
  icon: JSXElement
  label1?: string | JSXElement
  label2?: string | JSXElement
}

export type StatMatchSummaryPlayer = {
  [playerId: string]: {
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
  }
}

export type StatMatchSummary = {
  localScore: number
  opponentScore: number
  opponentRebonds: number
  opponentFouls: number
  players: StatMatchSummaryPlayer
}
