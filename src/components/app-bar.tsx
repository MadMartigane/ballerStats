import { RouteSectionProps } from '@solidjs/router'
import MenuIcon from '@suid/icons-material/Menu'
import {
  AppBar,
  Box,
  Button,
  IconButton,
  Toolbar,
  Typography,
} from '@suid/material'
import MadSignal from '../libs/mad-signal'

const hashReplacePattern = /^#\//

export default class AppBarE {
  private props: RouteSectionProps<unknown> | null = null
  private hash: MadSignal<string> = new MadSignal('')

  constructor(props: RouteSectionProps<unknown>) {
    this.props = props
    console.log('props: ', this.props)

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

  public render() {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
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
              {this.hash.get()}
            </Typography>
            <Button color="inherit">Login</Button>
          </Toolbar>
        </AppBar>
      </Box>
    )
  }
}
