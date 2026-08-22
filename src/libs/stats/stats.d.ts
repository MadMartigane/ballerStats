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

export interface StatMatchActionItem {
  everyTimeAction?: boolean
  icon: () => JSXElement
  inGameAction: boolean
  label1?: string | JSXElement
  label2?: string | JSXElement
  name: StatMatchActionItemName
  opponentMatter: boolean
  secondaryAction?: boolean
  type: StatMatchActionItemType
  value: number
}

export interface StatMatchSummaryRatio {
  fail: number
  percentage: number
  success: number
  total: number
}

export interface StatMatchSummaryPlayer {
  assists: number
  astToRatio: number
  blocks: number
  eff: number
  fouls: number
  nbPlayedMatch: number
  playerId: string
  playTime: number | null
  ratio: Record<ScoringKey, StatMatchSummaryRatio>
  rebonds: {
    defensive: number
    offensive: number
    total: number
  }
  scores: Record<ScoringKey, number> & { total: number }
  steals: number
  trueShootingPercentage: number
  turnover: number
}

export interface StatMatchSummaryRebonds {
  opponentDefensive: number
  opponentOffensive: number
  opponentTotal: number
  teamDefensive: number
  teamDefensivePercentage: number
  teamOffensive: number
  teamOffensivePercentage: number
  teamTotal: number
  teamTotalPercentage: number
}

export interface StatMatchSummary {
  opponentFouls: number
  opponentScore: number
  players: StatMatchSummaryPlayer[]
  rebonds: StatMatchSummaryRebonds
  teamAssists?: number
  teamFouls?: number
  teamScore: number
  teamScores: StatMatchSummaryPlayer
  teamSteals?: number
  teamTurnover?: number
}

/** Stats accepted by the full stat table: a plain summary, optionally carrying the cumulative totals row. */
export type StatTableStats = StatMatchSummary & { teamScoresTotal?: StatMatchSummaryPlayer }

/** Multi-match aggregate summary returned by getFullStats(). Always carries the
 *  raw cumulative team totals row alongside the per-game row. */
export type FullStatSummary = StatTableStats & {
  teamScoresTotal: StatMatchSummaryPlayer
}
