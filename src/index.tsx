/* @refresh reload */
import './index.css'

import { For, lazy } from 'solid-js'
import { render } from 'solid-js/web'
import { Route, HashRouter, RouteSectionProps } from '@solidjs/router'
import AppBarEl, { NavigationMenuItem } from './components/app-bar/app-bar'

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
      {props.children}
    </>
  )
}

render(
  () => (
    <HashRouter root={suidNav}>
      <For each={NavigationMenuItem}>
        {(menuItem) => (
          <Route path={menuItem.path} component={menuItem.lazy ? lazy(() => import(menuItem.lazy)) : menuItem.component} />
        )}
      </For>
    </HashRouter>
  ),
  root || document.body,
)
