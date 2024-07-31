import { MenuEntry } from './menu.d'
import { lazy } from 'solid-js'
import Home from '../../pages/home'


import { House, User, Users, ScatterChart, Boxes, FileSliders, BadgeAlert } from 'lucide-solid'

export const HASH_REPLACE_PATTERN = /^#\//

export const NAVIGATION_MENU_ENTRIES: Array<MenuEntry> = [
  {
    path: '/',
    label: 'Dashbord',
    icon: () => <img class="w-8 h-8" src="/img/logo_tiny.png" />,
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
    icon: () => <Users />,
    component: lazy(() => import('../../pages/players')),
    isMenuEntry: true,
  },
  {
    path: '/joueur',
    label: 'Joueur',
    icon: () => <User />,
    component: lazy(() => import('../../pages/player')),
    isMenuEntry: false,
  },

  {
    path: '/teams',
    label: 'Équipes',
    icon: () => <Boxes />,
    component: lazy(() => import('../../pages/teams')),
    isMenuEntry: true,
  },
  {
    path: '/matchs',
    label: 'Matches',
    icon: () => <FileSliders />,
    component: lazy(() => import('../../pages/matchs')),
    isMenuEntry: true,
  },
  {
    path: '/stats',
    label: 'Statistiques',
    icon: () => <ScatterChart />,
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


