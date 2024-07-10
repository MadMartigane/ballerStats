import { MenuEntry } from './menu.d'
import { lazy } from 'solid-js'
import Home from '../../pages/home'

import CrisisAlertIcon from '@suid/icons-material/CrisisAlert'
import GroupIcon from '@suid/icons-material/Group'
import GroupsIcon from '@suid/icons-material/Groups'
import HomeIcon from '@suid/icons-material/Home'
import InsightsIcon from '@suid/icons-material/Insights'
import PersonIcon from '@suid/icons-material/Person'
import SportsBasketballIcon from '@suid/icons-material/SportsBasketball'

export const HASH_REPLACE_PATTERN = /^#\//

export const NAVIGATION_MENU_ENTRIES: Array<MenuEntry> = [
  {
    path: '/',
    label: 'Acceuil',
    icon: () => <HomeIcon />,
    component: Home,
    isMenuEntry: true,
  },
  {
    path: '/users',
    label: 'Utilisateurs',
    icon: () => <PersonIcon />,
    component: lazy(() => import('../../pages/users')),
    isMenuEntry: true,
  },
  {
    path: '/user',
    label: 'Profile',
    icon: () => <PersonIcon />,
    component: lazy(() => import('../../pages/user')),
    isMenuEntry: false,
  },
  {
    path: '/players',
    label: 'Joueurs',
    icon: () => <GroupIcon />,
    component: lazy(() => import('../../pages/players')),
    isMenuEntry: true,
  },
  {
    path: '/joueur',
    label: 'Joueur',
    icon: () => <PersonIcon />,
    component: lazy(() => import('../../pages/player')),
    isMenuEntry: false,
  },

  {
    path: '/teams',
    label: 'Équipes',
    icon: () => <GroupsIcon />,
    component: lazy(() => import('../../pages/teams')),
    isMenuEntry: true,
  },
  {
    path: '/matchs',
    label: 'Matches',
    icon: () => <SportsBasketballIcon />,
    component: lazy(() => import('../../pages/matchs')),
    isMenuEntry: true,
  },
  {
    path: '/stats',
    label: 'Statistiques',
    icon: () => <InsightsIcon />,
    component: lazy(() => import('../../pages/stats')),
    isMenuEntry: true,
  },
  {
    path: '/*',
    label: '404 Not Found',
    icon: () => <CrisisAlertIcon />,
    component: lazy(() => import('../../pages/404')),
    isMenuEntry: false,
  },
]


