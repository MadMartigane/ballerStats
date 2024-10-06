import { lazy } from 'solid-js'
import Home from '../../pages/home'
import type { MenuEntry } from './menu.d'

import { BadgeAlert, ChartScatter, FileSliders, MonitorDot, User, Users } from 'lucide-solid'
import BsIconBasketballBall from '../../components/icons/basketball-ball'
import BsIconBasketballPlayer from '../../components/icons/basketball-player'
import type { DaisyVariant } from '../daisy'

export const HASH_REPLACE_PATTERN = /^#\//

export const NAVIGATION_MENU_ENTRIES: Array<MenuEntry> = [
  {
    path: '/',
    label: 'Dashbord',
    icon: () => <MonitorDot />,
    // icon: () => <img class="w-8 h-8" src="/img/logo_tiny.png" />,
    component: Home,
    isMenuEntry: false,
  },
  {
    path: '/users',
    label: 'Utilisateurs',
    icon: () => <Users />,
    component: lazy(() => import('../../pages/users')),
    isMenuEntry: false,
  },
  {
    path: '/user',
    label: 'Profile',
    icon: () => <User />,
    component: lazy(() => import('../../pages/user')),
    isMenuEntry: false,
  },
  {
    path: '/players',
    label: 'Joueurs',
    icon: (variant: DaisyVariant = 'neutral-content') => <BsIconBasketballPlayer variant={variant} />,
    component: lazy(() => import('../../pages/players')),
    isMenuEntry: true,
  },
  {
    path: '/teams',
    label: 'Équipes',
    icon: () => <Users />,
    component: lazy(() => import('../../pages/teams')),
    isMenuEntry: true,
  },
  {
    path: '/match/:id',
    label: 'Match',
    icon: (variant: DaisyVariant = 'neutral-content') => <BsIconBasketballBall variant={variant} />,
    component: lazy(() => import('../../pages/match')),
    isMenuEntry: false,
  },
  {
    path: '/matchs',
    label: 'Matchs',
    icon: () => <FileSliders />,
    component: lazy(() => import('../../pages/matchs')),
    isMenuEntry: true,
  },
  {
    path: '/stats',
    label: 'Statistiques',
    icon: () => <ChartScatter />,
    component: lazy(() => import('../../pages/stats')),
    isMenuEntry: true,
  },
  {
    path: '/*',
    label: '404 Not Found',
    icon: () => <BadgeAlert />,
    component: lazy(() => import('../../pages/404')),
    isMenuEntry: false,
  },
]
