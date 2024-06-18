/* @refresh reload */
import './index.css'

import { createSignal, lazy } from 'solid-js'
import { render } from 'solid-js/web'
import { Route, HashRouter, RouteSectionProps } from '@solidjs/router'
import Home from './pages/home'
import AppBarE from './components/app-bar'

const root = document.getElementById('app')

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  )
}

function suidNav(props: RouteSectionProps<unknown>) {
  const appBar = new AppBarE()
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
      <Route path="/teams" component={lazy(() => import('./pages/teams'))} />
      <Route path="/users" component={lazy(() => import('./pages/users'))} />
      <Route path="/" component={Home} />
      <Route path="/*" component={lazy(() => import('./pages/404'))} />
    </HashRouter>
  ),
  root || document.body,
)
