import type { StatMatchActionItemName, StatMatchActionItemType } from './stats.d'

export interface StatActionDefault {
  name: StatMatchActionItemName
  type: StatMatchActionItemType
  value: number
}

export const STAT_ACTION_DEFAULTS: StatActionDefault[] = [
  { name: '2pts', type: 'success', value: 2 },
  { name: '2pts', type: 'error', value: 0 },
  { name: '3pts', type: 'success', value: 3 },
  { name: '3pts', type: 'error', value: 0 },
  { name: 'free-throw', type: 'success', value: 1 },
  { name: 'free-throw', type: 'error', value: 0 },
  { name: 'offensive-rebond', type: 'success', value: 1 },
  { name: 'defensive-rebond', type: 'secondary', value: 1 },
  { name: 'turnover', type: 'error', value: 1 },
  { name: 'steals', type: 'success', value: 1 },
  { name: 'block', type: 'success', value: 1 },
  { name: 'foul', type: 'error', value: 1 },
  { name: 'assist', type: 'success', value: 1 },
  { name: 'fiveIn', type: 'success', value: 0 },
  { name: 'fiveOut', type: 'secondary', value: 0 },
  { name: 'gameStop', type: 'secondary', value: 0 },
  { name: 'gameStart', type: 'secondary', value: 0 },
]
