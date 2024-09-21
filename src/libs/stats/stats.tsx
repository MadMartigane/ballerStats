import {
  ArrowLeftFromLine,
  Ban,
  CircleOff,
  Hand,
  IterationCcw,
  RedoDot,
} from 'lucide-solid'
import BsIconBasketballGoal from '../../components/icons/basketball-goal'
import BsIconBasketballMissedGoal from '../../components/icons/basketball-missed-goal'
import type { StatMatchActionItem } from './stats.d'

export const STATS_MATCH_ACTIONS: Array<StatMatchActionItem> = [
  {
    name: '2pts',
    inGameAction: true,
    label1: '2',
    label2: 'pts',
    type: 'success',
    value: 2,
    icon: <BsIconBasketballGoal variant="neutral-content" />,
  },
  {
    name: '2pts',
    inGameAction: true,
    label1: '2',
    label2: 'pts',
    type: 'error',
    value: 0,
    icon: <BsIconBasketballMissedGoal variant="neutral-content" />,
  },
  {
    name: '3pts',
    inGameAction: true,
    label1: '3',
    label2: 'pts',
    type: 'success',
    value: 3,
    icon: <BsIconBasketballGoal variant="neutral-content" />,
  },
  {
    name: '3pts',
    inGameAction: true,
    label1: '3',
    label2: 'pts',
    type: 'error',
    value: 0,
    icon: <BsIconBasketballMissedGoal variant="neutral-content" />,
  },
  {
    name: 'free-throw',
    inGameAction: false,
    label1: 'LF',
    label2: '',
    type: 'success',
    value: 1,
    icon: <BsIconBasketballGoal variant="neutral-content" />,
  },
  {
    name: 'free-throw',
    inGameAction: false,
    label1: 'LF',
    label2: 'Échec',
    type: 'error',
    value: 0,
    icon: <BsIconBasketballMissedGoal variant="neutral-content" />,
  },
  {
    name: 'offensive-rebond',
    inGameAction: true,
    label1: 'O-R',
    label2: <IterationCcw />,
    type: 'success',
    value: 1,
    icon: <Hand />,
  },
  {
    name: 'turnover',
    inGameAction: true,
    label1: 'TO',
    label2: 'Balle Perdu',
    type: 'error',
    value: 1,
    icon: <CircleOff />,
  },
  {
    name: 'defensive-rebond',
    inGameAction: true,
    label1: 'D-R',
    label2: <ArrowLeftFromLine />,
    type: 'secondary',
    value: 1,
    icon: <Hand />,
  },
  {
    name: 'foul',
    inGameAction: false,
    label1: 'Faute !',
    type: 'error',
    value: 1,
    icon: <Ban />,
  },
  {
    name: 'assist',
    inGameAction: true,
    label1: 'Passe D',
    type: 'success',
    value: 1,
    icon: <RedoDot />,
  },
]
