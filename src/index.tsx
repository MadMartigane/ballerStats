/* @refresh reload */
import './index.css'

import { createSignal, lazy } from 'solid-js'
import { render } from 'solid-js/web'
import { Route, HashRouter, RouteSectionProps } from '@solidjs/router'
import Home from './pages/home'
import {
  AppBar,
  Divider,
  Button,
  Box,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
  Toolbar,
} from '@suid/material'

import { ThemeProvider } from '@suid/material/styles'

import MenuIcon from '@suid/icons-material/Menu'
import Logout from '@suid/icons-material/Logout'
import PersonAdd from '@suid/icons-material/PersonAdd'
import Settings from '@suid/icons-material/Settings'
import PersonIcon from '@suid/icons-material/Person'
import GroupIcon from '@suid/icons-material/Group'

const root = document.getElementById('app')

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  )
}

const [anchorEl, setAnchorEl] = createSignal<null | HTMLElement>(null)

function open() {
  return Boolean(anchorEl())
}

function handleClose() {
  setAnchorEl(null)
}

function goTo(path: string) {
  console.log('[GO TO]: ', path)
  window.location.hash = path
}

const suidNav = (props: RouteSectionProps<unknown>) => (
  <>
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            title="Main menu"
            edge="start"
            size="large"
            sx={{ ml: 2 }}
            color="inherit"
            aria-label="menu"
            aria-controls={open() ? 'account-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open() ? 'true' : undefined}
            onClick={event => setAnchorEl(event.currentTarget)}
          >
            <MenuIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl()}
            id="main-menu"
            open={open()}
            onClose={handleClose}
            onClick={handleClose}
            PaperProps={{
              elevation: 0,
              sx: {
                overflow: 'visible',
                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                mt: 1.5,
                ['& .MuiAvatar-root']: {
                  width: 32,
                  height: 32,
                  ml: -0.5,
                  mr: 1,
                },
                '&:before': {
                  content: '""',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  right: 14,
                  width: 10,
                  height: 10,
                  bgcolor: 'background.paper',
                  transform: 'translateY(-50%) rotate(45deg)',
                  zIndex: 0,
                },
              },
            }}
            transformOrigin={{
              horizontal: 'right',
              vertical: 'top',
            }}
            anchorOrigin={{
              horizontal: 'left',
              vertical: 'bottom',
            }}
          >
            <MenuItem onClick={goTo('users')}>
              <PersonIcon fontSize="large" /> Users
            </MenuItem>
            <MenuItem onClick={goTo('teams')}>
              <GroupIcon fontSize="large" /> Teams
            </MenuItem>
            <Divider />
            <MenuItem>
              <ListItemIcon>
                <PersonAdd fontSize="small" />
              </ListItemIcon>
              Add another account
            </MenuItem>
            <MenuItem>
              <ListItemIcon>
                <Settings fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>
            <MenuItem>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {props.location.pathname}
          </Typography>
          <Button color="inherit">Login</Button>
        </Toolbar>
      </AppBar>
    </Box>

    <Box sx={{ flexGrow: 1 }}>
      <ThemeProvider theme={darkTheme}>
        <AppBar position="static">
          <Toolbar color="primary" enableColorOnDark>
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="menu"
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              {props.location.pathname}
            </Typography>
            <Button color="inherit">Login</Button>
          </Toolbar>
        </AppBar>
      </ThemeProvider>
    </Box>

    {props.children}
  </>
)

render(
  () => (
    <HashRouter root={suidNav}>
      <Route path="/teams" component={lazy(() => import('./pages/teams'))} />
      <Route path="/users" component={lazy(() => import('./pages/users'))} />
      <Route path="/" component={Home} />
      <Route path="/*" component={lazy(() => import('./pages/404'))} />
    </HashRouter>
  ),
  root || document.body,
)
