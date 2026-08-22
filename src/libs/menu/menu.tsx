import { BadgeAlert, ChartScatter, FileSliders, LayoutGrid, MonitorDot, User, Users } from 'lucide-solid'
import { lazy } from 'solid-js'
import BsIconBasketballBall from '../../components/icons/basketball-ball'
import BsIconBasketballPlayer from '../../components/icons/basketball-player'
import Home from '../../pages/home'
import type { MenuEntry } from './menu.d'
import { ROUTE_PLAYERS, ROUTE_TEAMS, ROUTE_TROMBI, ROUTE_TROMBI_TEAM } from './routes'

export const HASH_REPLACE_PATTERN = /^#\//

export const NAVIGATION_MENU_ENTRIES: MenuEntry[] = [
  {
    // icon: () => <img class="w-8 h-8" src="/img/logo_tiny.png" />,
    component: Home,
    icon: () => <MonitorDot />,
    isMenuEntry: false,
    label: 'Dashbord',
    path: '/',
  },
  {
    component: lazy(() => import('../../pages/users')),
    icon: () => <Users />,
    isMenuEntry: false,
    label: 'Utilisateurs',
    path: '/users',
  },
  {
    component: lazy(() => import('../../pages/user')),
    icon: () => <User />,
    isMenuEntry: false,
    label: 'Profile',
    path: '/user',
  },
  {
    component: lazy(() => import('../../pages/players')),
    icon: () => <BsIconBasketballPlayer />,
    isMenuEntry: true,
    label: 'Joueurs',
    path: ROUTE_PLAYERS,
  },
  {
    component: lazy(() => import('../../pages/trombi')),
    icon: () => <LayoutGrid />,
    isMenuEntry: false,
    label: 'Trombinoscope',
    path: ROUTE_TROMBI,
  },
  {
    component: lazy(() => import('../../pages/trombi-team')),
    icon: () => <LayoutGrid />,
    isMenuEntry: false,
    label: 'Trombinoscope équipe',
    path: ROUTE_TROMBI_TEAM,
  },
  {
    component: lazy(() => import('../../pages/teams')),
    icon: () => <Users />,
    isMenuEntry: true,
    label: 'Équipes',
    path: ROUTE_TEAMS,
  },
  {
    component: lazy(() => import('../../pages/match')),
    icon: () => <BsIconBasketballBall />,
    isMenuEntry: false,
    label: 'Match',
    path: '/match/:id',
  },
  {
    component: lazy(() => import('../../pages/matchs')),
    icon: () => <FileSliders />,
    isMenuEntry: true,
    label: 'Matchs',
    path: '/matchs',
  },
  {
    component: lazy(() => import('../../pages/stats')),
    icon: () => <ChartScatter />,
    isMenuEntry: true,
    label: 'Statistiques',
    path: '/stats',
  },
  {
    component: lazy(() => import('../../pages/404')),
    icon: () => <BadgeAlert />,
    isMenuEntry: false,
    label: '404 Not Found',
    path: '/*',
  },
]
