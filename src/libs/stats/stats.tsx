import {
  ArrowLeftFromLine,
  Ban,
  Hand,
  IterationCcw,
  RedoDot,
} from 'lucide-solid'
import BsIconBasketballGoal from '../../components/icons/basketball-goal'
import BsIconBasketballMissedGoal from '../../components/icons/basketball-missed-goal'
import { StatMatchActionItem } from './stats.d'

export const STATS_MATCH_ACTIONS: Array<StatMatchActionItem> = [
  {
    name: '2pts',
    label1: '2',
    label2: 'pts',
    type: 'success',
    value: 2,
    icon: <BsIconBasketballGoal variant="neutral-content" />,
  },
  {
    name: '2pts',
    label1: '2',
    label2: 'pts',
    type: 'error',
    value: 0,
    icon: <BsIconBasketballMissedGoal variant="neutral-content" />,
  },
  {
    name: '3pts',
    label1: '3',
    label2: 'pts',
    type: 'success',
    value: 3,
    icon: <BsIconBasketballGoal variant="neutral-content" />,
  },
  {
    name: '3pts',
    label1: '3',
    label2: 'pts',
    type: 'error',
    value: 0,
    icon: <BsIconBasketballMissedGoal variant="neutral-content" />,
  },
  {
    name: 'free-throw',
    label1: 'LF',
    label2: '',
    type: 'success',
    value: 1,
    icon: <BsIconBasketballGoal variant="neutral-content" />,
  },
  {
    name: 'free-throw',
    label1: 'LF',
    label2: 'Échec',
    type: 'error',
    value: 0,
    icon: <BsIconBasketballMissedGoal variant="neutral-content" />,
  },
  {
    name: 'offensive-rebond',
    label1: 'O-R',
    label2: <IterationCcw />,
    type: 'success',
    value: 1,
    icon: <Hand />,
  },
  {
    name: 'defensive-rebond',
    label1: 'D-R',
    label2: <ArrowLeftFromLine />,
    type: 'success',
    value: 1,
    icon: <Hand />,
  },
  {
    name: 'assist',
    label1: 'Passe D',
    type: 'success',
    value: 1,
    icon: <RedoDot />,
  },
  {
    name: 'foul',
    label1: 'Faute !',
    type: 'error',
    value: 1,
    icon: <Ban />,
  },
]
