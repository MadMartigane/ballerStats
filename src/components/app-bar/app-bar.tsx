import MadSignal from '../../libs/mad-signal'
import CloseIcon from '@suid/icons-material/Close'
import GroupIcon from '@suid/icons-material/Group'
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

const hashReplacePattern = /^#\//

const NavigationMenuItem: Array<AppBarMenuEntry> = [
  { path: '/', label: 'Acceuil', icon: () => <HomeIcon /> },
  { path: '/users', label: 'Utilisateurs', icon: () => <PersonIcon /> },
  { path: '/teams', label: 'Équipes', icon: () => <GroupIcon /> },
  { path: '/matchs', label: 'Matches', icon: () => <SportsBasketballIcon /> },
  { path: '/stats', label: 'Statistiques', icon: () => <InsightsIcon /> },
]

export default class AppBarE {
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
            <ListItem disablePadding>
              <ListItemButton onClick={() => this.goTo(item.path)}>
                <ListItemIcon>{item.icon()}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
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
          <AppBar position="static">
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
