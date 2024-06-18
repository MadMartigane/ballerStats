import MadSignal from '../libs/mad-signal'
import MenuIcon from '@suid/icons-material/Menu'
import PersonIcon from '@suid/icons-material/Person'
import GroupIcon from '@suid/icons-material/Group'
import CloseIcon from '@suid/icons-material/Close'
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

const hashReplacePattern = /^#\//

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
          <ListItem disablePadding>
            <ListItemButton
                onClick={() => this.goTo("/users")}
            >
              <ListItemIcon>
                <PersonIcon />
              </ListItemIcon>
              <ListItemText primary="Users" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton
                onClick={() => this.goTo("/teams")}
            >
              <ListItemIcon>
                <GroupIcon />
              </ListItemIcon>
              <ListItemText primary="Teams" />
            </ListItemButton>
          </ListItem>
        </List>
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton>
              <ListItemIcon>
                <CloseIcon />
              </ListItemIcon>
              <ListItemText primary="Close" />
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
                {this.hash.get()}
                {this.isMenuOpen.get() ? ' open' : null}
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
