import MadSignal from '../../libs/mad-signal'
import CrisisAlertIcon from '@suid/icons-material/CrisisAlert'
import CloseIcon from '@suid/icons-material/Close'
import GroupIcon from '@suid/icons-material/Group'
import GroupsIcon from '@suid/icons-material/Groups'
import HomeIcon from '@suid/icons-material/Home'
import InsightsIcon from '@suid/icons-material/Insights'
import MenuIcon from '@suid/icons-material/Menu'
import PersonIcon from '@suid/icons-material/Person'
import SportsBasketballIcon from '@suid/icons-material/SportsBasketball'
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Toolbar,
  Typography,
} from '@suid/material'
import { AppBarMenuEntry } from './app-bar.d'
import Home from './../../pages/home'
import { lazy, Show } from 'solid-js'

const hashReplacePattern = /^#\//

export const NavigationMenuItem: Array<AppBarMenuEntry> = [
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
    component: lazy(() => import('./../../pages/users')),
    isMenuEntry: true,
  },
  {
    path: '/user',
    label: 'Profile',
    icon: () => <PersonIcon />,
    component: lazy(() => import('./../../pages/user')),
    isMenuEntry: false,
  },
  {
    path: '/players',
    label: 'Joueurs',
    icon: () => <GroupIcon />,
    component: lazy(() => import('./../../pages/players')),
    isMenuEntry: true,
  },
  {
    path: '/joueur',
    label: 'Joueur',
    icon: () => <PersonIcon />,
    component: lazy(() => import('./../../pages/player')),
    isMenuEntry: false,
  },

  {
    path: '/teams',
    label: 'Équipes',
    icon: () => <GroupsIcon />,
    component: lazy(() => import('./../../pages/teams')),
    isMenuEntry: true,
  },
  {
    path: '/matchs',
    label: 'Matches',
    icon: () => <SportsBasketballIcon />,
    component: lazy(() => import('./../../pages/matchs')),
    isMenuEntry: true,
  },
  {
    path: '/stats',
    label: 'Statistiques',
    icon: () => <InsightsIcon />,
    component: lazy(() => import('./../../pages/stats')),
    isMenuEntry: true,
  },
  {
    path: '/*',
    label: '404 Not Found',
    icon: () => <CrisisAlertIcon />,
    component: lazy(() => import('./../../pages/404')),
    isMenuEntry: false,
  },
]

export default class AppBarEl {
  private hash: MadSignal<string> = new MadSignal('')
  private isMenuOpen: MadSignal<boolean> = new MadSignal(false)

  constructor() {
    this.installEventListener()
    this.updatePath()
  }

  private updatePath() {
    this.hash.set(window.location.hash.replace(hashReplacePattern, ''))
  }

  private installEventListener() {
    window.addEventListener('hashchange', () => {
      this.updatePath()
    })
  }

  private toggleMenu(open?: boolean) {
    if (open !== undefined) {
      this.isMenuOpen.set(open)
      return
    }

    this.isMenuOpen.set(!this.isMenuOpen.get() || false)
  }

  private goTo(path: string) {
    window.location.hash = path
  }

  private findMenuItemFromHash(hash: string | null) {
    if (!hash) {
      return NavigationMenuItem[0].label
    }

    const item = NavigationMenuItem.find(item => item.path.endsWith(hash))
    return (item && item.label) || '404'
  }

  private renderMenu() {
    return (
      <Box
        component="menu"
        sx={{ width: 'auto' }}
        role="presentation"
        onClick={() => this.toggleMenu(false)}
        onKeyDown={() => this.toggleMenu(false)}
      >
        <List>
          {NavigationMenuItem.map(item => (
            <Show when={item.isMenuEntry}>
              <ListItem disablePadding>
                <ListItemButton onClick={() => this.goTo(item.path)}>
                  <ListItemIcon>{item.icon()}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            </Show>
          ))}
        </List>
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton>
              <ListItemIcon>
                <CloseIcon />
              </ListItemIcon>
              <ListItemText primary="Fermer le menu" />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    )
  }

  public render() {
    return (
      <>
        <Box sx={{ flexGrow: 1 }}>
          <AppBar position="fixed">
            <Toolbar>
              <IconButton
                size="large"
                edge="start"
                color="inherit"
                aria-label="menu"
                sx={{ mr: 2 }}
                onClick={() => this.toggleMenu()}
              >
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                {this.findMenuItemFromHash(this.hash.get())}
              </Typography>
              <Button color="inherit">Login</Button>
            </Toolbar>
          </AppBar>
        </Box>
        <Drawer
          component="menu"
          anchor="left"
          open={Boolean(this.isMenuOpen.get())}
          onClose={() => this.toggleMenu(false)}
          sx={{ zIndex: 9999 }}
        >
          {this.renderMenu()}
        </Drawer>
      </>
    )
  }
}
