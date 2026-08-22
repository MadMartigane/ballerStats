import {
  ArrowLeftToLine,
  ArrowRightFromLine,
  Ban,
  BicepsFlexed,
  Blocks,
  CircleOff,
  CirclePause,
  CirclePlay,
  Hand,
  RedoDot,
} from 'lucide-solid'
import BsIconBasketballGoal from '../../components/icons/basketball-goal'
import BsIconBasketballMissedGoal from '../../components/icons/basketball-missed-goal'
import type { StatMatchActionItem, StatMatchActionItemName, StatMatchActionItemType } from './stats.d'
import { STAT_ACTION_DEFAULTS, type StatActionDefault } from './stats-action-values'

const d = (name: StatMatchActionItemName, type: StatMatchActionItemType): StatActionDefault => {
  const found = STAT_ACTION_DEFAULTS.find((a) => a.name === name && a.type === type)
  if (!found) {
    throw new Error(`Missing stat action default for ${name}:${type}`)
  }
  return found
}

export const STATS_MATCH_ACTIONS: StatMatchActionItem[] = [
  {
    ...d('2pts', 'success'),
    icon: () => <BsIconBasketballGoal />,
    inGameAction: true,
    label1: '2 pts',
    opponentMatter: true,
  },
  {
    ...d('2pts', 'error'),
    icon: () => <BsIconBasketballMissedGoal />,
    inGameAction: true,
    label1: '2 pts',
    opponentMatter: false,
  },
  {
    ...d('3pts', 'success'),
    icon: () => <BsIconBasketballGoal />,
    inGameAction: true,
    label1: '3 pts',
    opponentMatter: true,
  },
  {
    ...d('3pts', 'error'),
    icon: () => <BsIconBasketballMissedGoal />,
    inGameAction: true,
    label1: '3 pts',
    opponentMatter: false,
  },
  {
    ...d('free-throw', 'success'),
    icon: () => <BsIconBasketballGoal />,
    inGameAction: false,
    label1: 'LF',
    opponentMatter: true,
  },
  {
    ...d('free-throw', 'error'),
    icon: () => <BsIconBasketballMissedGoal />,
    inGameAction: false,
    label1: 'LF',
    label2: 'Échec',
    opponentMatter: false,
  },
  {
    ...d('offensive-rebond', 'success'),
    icon: () => <Hand />,
    inGameAction: true,
    label1: 'O-R',
    label2: 'Rebond Offensif',
    opponentMatter: true,
  },
  {
    ...d('defensive-rebond', 'secondary'),
    icon: () => <Hand />,
    inGameAction: true,
    label1: 'D-R',
    label2: 'Rebond Defensive',
    opponentMatter: true,
  },
  {
    ...d('turnover', 'error'),
    everyTimeAction: true,
    icon: () => <CircleOff />,
    inGameAction: true,
    label1: 'TO',
    label2: 'Balle Perdu',
    opponentMatter: false,
  },
  {
    ...d('steals', 'success'),
    everyTimeAction: true,
    icon: () => <BicepsFlexed />,
    inGameAction: true,
    label1: 'ST',
    label2: 'Steals',
    opponentMatter: false,
  },
  {
    ...d('block', 'success'),
    everyTimeAction: true,
    icon: () => <Blocks />,
    inGameAction: true,
    label1: 'Contre',
    label2: 'Contres',
    opponentMatter: false,
  },
  {
    ...d('foul', 'error'),
    icon: () => <Ban />,
    inGameAction: false,
    label1: 'Faute !',
    opponentMatter: true,
  },
  {
    ...d('assist', 'success'),
    icon: () => <RedoDot />,
    inGameAction: true,
    label1: 'Passe D',
    opponentMatter: false,
  },
  {
    ...d('fiveIn', 'success'),
    icon: () => <ArrowLeftToLine />,
    inGameAction: false,
    label1: 'Entrée sur le terrain',
    opponentMatter: false,
    secondaryAction: true,
  },
  {
    ...d('fiveOut', 'secondary'),
    icon: () => <ArrowRightFromLine />,
    inGameAction: false,
    label1: 'Sortie sur le banc',
    opponentMatter: false,
    secondaryAction: true,
  },
  {
    ...d('gameStop', 'secondary'),
    icon: () => <CirclePause />,
    inGameAction: false,
    label1: 'Arrêt du jeu',
    opponentMatter: false,
    secondaryAction: true,
  },
  {
    ...d('gameStart', 'secondary'),
    icon: () => <CirclePlay />,
    inGameAction: false,
    label1: 'Reprise du jeu',
    opponentMatter: false,
    secondaryAction: true,
  },
]
