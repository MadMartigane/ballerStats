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
    inGameAction: true,
    opponentMatter: true,
    label1: '2 pts',
    icon: () => <BsIconBasketballGoal />,
  },
  {
    ...d('2pts', 'error'),
    inGameAction: true,
    opponentMatter: false,
    label1: '2 pts',
    icon: () => <BsIconBasketballMissedGoal />,
  },
  {
    ...d('3pts', 'success'),
    inGameAction: true,
    opponentMatter: true,
    label1: '3 pts',
    icon: () => <BsIconBasketballGoal />,
  },
  {
    ...d('3pts', 'error'),
    inGameAction: true,
    opponentMatter: false,
    label1: '3 pts',
    icon: () => <BsIconBasketballMissedGoal />,
  },
  {
    ...d('free-throw', 'success'),
    inGameAction: false,
    opponentMatter: true,
    label1: 'LF',
    icon: () => <BsIconBasketballGoal />,
  },
  {
    ...d('free-throw', 'error'),
    inGameAction: false,
    opponentMatter: false,
    label1: 'LF',
    label2: 'Échec',
    icon: () => <BsIconBasketballMissedGoal />,
  },
  {
    ...d('offensive-rebond', 'success'),
    inGameAction: true,
    opponentMatter: true,
    label1: 'O-R',
    label2: 'Rebond Offensif',
    icon: () => <Hand />,
  },
  {
    ...d('defensive-rebond', 'secondary'),
    inGameAction: true,
    opponentMatter: true,
    label1: 'D-R',
    label2: 'Rebond Defensive',
    icon: () => <Hand />,
  },
  {
    ...d('turnover', 'error'),
    inGameAction: true,
    opponentMatter: false,
    label1: 'TO',
    label2: 'Balle Perdu',
    everyTimeAction: true,
    icon: () => <CircleOff />,
  },
  {
    ...d('steals', 'success'),
    inGameAction: true,
    opponentMatter: false,
    label1: 'ST',
    label2: 'Steals',
    everyTimeAction: true,
    icon: () => <BicepsFlexed />,
  },
  {
    ...d('block', 'success'),
    inGameAction: true,
    opponentMatter: false,
    everyTimeAction: true,
    label1: 'Contre',
    label2: 'Contres',
    icon: () => <Blocks />,
  },
  {
    ...d('foul', 'error'),
    inGameAction: false,
    opponentMatter: true,
    label1: 'Faute !',
    icon: () => <Ban />,
  },
  {
    ...d('assist', 'success'),
    inGameAction: true,
    opponentMatter: false,
    label1: 'Passe D',
    icon: () => <RedoDot />,
  },
  {
    ...d('fiveIn', 'success'),
    inGameAction: false,
    opponentMatter: false,
    label1: 'Entrée sur le terrain',
    secondaryAction: true,
    icon: () => <ArrowLeftToLine />,
  },
  {
    ...d('fiveOut', 'secondary'),
    inGameAction: false,
    opponentMatter: false,
    label1: 'Sortie sur le banc',
    secondaryAction: true,
    icon: () => <ArrowRightFromLine />,
  },
  {
    ...d('gameStop', 'secondary'),
    inGameAction: false,
    opponentMatter: false,
    label1: 'Arrêt du jeu',
    secondaryAction: true,
    icon: () => <CirclePause />,
  },
  {
    ...d('gameStart', 'secondary'),
    inGameAction: false,
    opponentMatter: false,
    label1: 'Reprise du jeu',
    secondaryAction: true,
    icon: () => <CirclePlay />,
  },
]
