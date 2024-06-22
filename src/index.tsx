/* @refresh reload */
import './index.css'

import { For } from 'solid-js'
import { render } from 'solid-js/web'
import { Route, HashRouter, RouteSectionProps } from '@solidjs/router'
import AppBarEl, { NavigationMenuItem } from './components/app-bar/app-bar'
import { Box } from '@suid/material'

const root = document.getElementById('app')

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  )
}

function suidNav(props: RouteSectionProps<unknown>) {
  const appBar = new AppBarEl()
  return (
    <>
      {appBar.render()}
      <Box class="pt-12">{props.children}</Box>
    </>
  )
}

render(
  () => (
    <HashRouter root={suidNav}>
      <For each={NavigationMenuItem}>
        {menuItem => (
          <Route path={menuItem.path} component={menuItem.component} />
        )}
      </For>
    </HashRouter>
  ),
  root || document.body,
)
