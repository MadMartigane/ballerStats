import { MenuEntry } from './menu.d'
import { lazy } from 'solid-js'
import Home from '../../pages/home'

import {
  User,
  Users,
  ScatterChart,
  Boxes,
  FileSliders,
  BadgeAlert,
  MonitorDot,
  Hand,
  PictureInPicture,
} from 'lucide-solid'

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
    icon: () => <Users />,
    component: lazy(() => import('../../pages/players')),
    isMenuEntry: true,
  },
  {
    path: '/teams',
    label: 'Équipes',
    icon: () => <Boxes />,
    component: lazy(() => import('../../pages/teams')),
    isMenuEntry: true,
  },
  {
    path: '/match/:id',
    label: 'Match',
    icon: () => <PictureInPicture />,
    /* icon: () => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="24px"
        viewBox="0 -960 960 960"
        width="24px"
        fill="#e8eaed"
      >
        <path d="M162-520h114q-6-38-23-71t-43-59q-18 29-30.5 61.5T162-520Zm522 0h114q-5-36-17.5-68.5T750-650q-26 26-43 59t-23 71ZM210-310q26-26 43-59t23-71H162q5 36 17.5 68.5T210-310Zm540 0q18-29 30.5-61.5T798-440H684q6 38 23 71t43 59ZM358-520h82v-278q-53 8-98.5 29.5T260-712q39 38 64.5 86.5T358-520Zm162 0h82q8-57 33.5-105.5T700-712q-36-35-81.5-56.5T520-798v278Zm-80 358v-278h-82q-8 57-33.5 105.5T260-248q36 35 81.5 56.5T440-162Zm80 0q53-8 98.5-29.5T700-248q-39-38-64.5-86.5T602-440h-82v278Zm-40-318Zm0 400q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
      </svg>
    ), */
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
