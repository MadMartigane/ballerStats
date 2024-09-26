import {
  ArrowLeftFromLine,
  ArrowLeftToLine,
  ArrowRightFromLine,
  ArrowRightToLine,
  Ban,
  CircleOff,
  CirclePause,
  CirclePlay,
  Hand,
  IterationCcw,
  RedoDot,
} from 'lucide-solid'
import BsIconBasketballGoal from '../../components/icons/basketball-goal'
import BsIconBasketballMissedGoal from '../../components/icons/basketball-missed-goal'
import type { StatMatchActionItem } from './stats.d'
import type { DaisyVariant, DaisySize } from '../daisy'

export const STATS_MATCH_ACTIONS: Array<StatMatchActionItem> = [
  {
    name: '2pts',
    inGameAction: true,
    opponentMatter: true,
    label1: '2 pts',
    type: 'success',
    value: 2,
    icon: (variant?: DaisyVariant, size?: DaisySize) => (
      <BsIconBasketballGoal variant={variant} size={size} />
    ),
  },
  {
    name: '2pts',
    inGameAction: true,
    opponentMatter: false,
    label1: '2 pts',
    type: 'error',
    value: 0,
    icon: (variant?: DaisyVariant, size?: DaisySize) => (
      <BsIconBasketballMissedGoal variant={variant} size={size} />
    ),
  },
  {
    name: '3pts',
    inGameAction: true,
    opponentMatter: true,
    label1: '3 pts',
    type: 'success',
    value: 3,
    icon: (variant?: DaisyVariant, size?: DaisySize) => (
      <BsIconBasketballGoal variant={variant} size={size} />
    ),
  },
  {
    name: '3pts',
    inGameAction: true,
    opponentMatter: false,
    label1: '3 pts',
    type: 'error',
    value: 0,
    icon: (variant?: DaisyVariant, size?: DaisySize) => (
      <BsIconBasketballMissedGoal variant={variant} size={size} />
    ),
  },
  {
    name: 'free-throw',
    inGameAction: false,
    opponentMatter: true,
    label1: 'LF',
    type: 'success',
    value: 1,
    icon: (variant?: DaisyVariant, size?: DaisySize) => (
      <BsIconBasketballGoal variant={variant} size={size} />
    ),
  },
  {
    name: 'free-throw',
    inGameAction: false,
    opponentMatter: false,
    label1: 'LF',
    label2: 'Échec',
    type: 'error',
    value: 0,
    icon: (variant?: DaisyVariant, size?: DaisySize) => (
      <BsIconBasketballMissedGoal variant={variant} size={size} />
    ),
  },
  {
    name: 'offensive-rebond',
    inGameAction: true,
    opponentMatter: true,
    label1: 'O-R',
    label2: 'Rebond Offensif',
    type: 'success',
    value: 1,
    icon: (variant?: DaisyVariant, size?: DaisySize) => <Hand size={size} />,
  },
  {
    name: 'defensive-rebond',
    inGameAction: true,
    opponentMatter: true,
    label1: 'D-R',
    label2: 'Rebond Defensive',
    type: 'secondary',
    value: 1,
    icon: (variant?: DaisyVariant, size?: DaisySize) => <Hand size={size} />,
  },
  {
    name: 'turnover',
    inGameAction: true,
    opponentMatter: false,
    label1: 'TO',
    label2: 'Balle Perdu',
    type: 'error',
    value: 1,
    everyTimeAction: true,
    icon: (variant?: DaisyVariant, size?: DaisySize) => (
      <CircleOff size={size} />
    ),
  },
  {
    name: 'foul',
    inGameAction: false,
    opponentMatter: true,
    label1: 'Faute !',
    type: 'error',
    value: 1,
    icon: (variant?: DaisyVariant, size?: DaisySize) => <Ban size={size} />,
  },
  {
    name: 'assist',
    inGameAction: true,
    opponentMatter: false,
    label1: 'Passe D',
    type: 'success',
    value: 1,
    icon: (variant?: DaisyVariant, size?: DaisySize) => <RedoDot size={size} />,
  },
  {
    name: 'fiveIn',
    inGameAction: false,
    opponentMatter: false,
    label1: 'Entrée sur le terrain',
    type: 'success',
    value: 0,
    secondaryAction: true,
    icon: (variant?: DaisyVariant, size?: DaisySize) => (
      <ArrowLeftToLine size={size} />
    ),
  },
  {
    name: 'fiveOut',
    inGameAction: false,
    opponentMatter: false,
    label1: 'Sortie sur le banc',
    type: 'secondary',
    value: 0,
    secondaryAction: true,
    icon: (variant?: DaisyVariant, size?: DaisySize) => (
      <ArrowRightFromLine size={size} />
    ),
  },
  {
    name: 'gameStop',
    inGameAction: false,
    opponentMatter: false,
    label1: 'Arrêt du jeu',
    type: 'secondary',
    value: 0,
    secondaryAction: true,
    icon: (variant?: DaisyVariant, size?: DaisySize) => (
      <CirclePause size={size} />
    ),
  },
  {
    name: 'gameStart',
    inGameAction: false,
    opponentMatter: false,
    label1: 'Reprise du jeu',
    type: 'secondary',
    value: 0,
    secondaryAction: true,
    icon: (variant?: DaisyVariant, size?: DaisySize) => (
      <CirclePlay size={size} />
    ),
  },
]
