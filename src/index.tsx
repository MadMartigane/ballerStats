/* @refresh reload */
import './index.css'

import { lazy } from 'solid-js'
import { render } from 'solid-js/web'
import { Route, Router, RouteSectionProps } from '@solidjs/router'
import Home from './pages/home'

const root = document.getElementById('app')

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  )
}

const Nav = (props: RouteSectionProps<unknown>) => (
  <>
    <nav class="bg-gray-200 text-gray-900 px-4">
      <ul class="flex items-center">
        <li class="py-2 px-4">
          <a href="/" class="no-underline hover:underline">
            Home
          </a>
        </li>
        <li class="py-2 px-4">
          <a href="/about" class="no-underline hover:underline">
            About
          </a>
        </li>
        <li class="py-2 px-4">
          <a href="/404" class="no-underline hover:underline">
            Error
          </a>
        </li>

        <li class="text-sm flex items-center space-x-1 ml-auto">
          <span>URL:</span>
          <input
            class="w-75px p-1 bg-white text-sm rounded-lg"
            type="text"
            readOnly
            value={props.location.pathname}
          />
        </li>
      </ul>
    </nav>

    {props.children}
  </>
)

render(
  () => (
    <Router root={Nav}>
      <Route path="/" component={Home} />
      <Route path="/about" component={lazy(() => import('./pages/about'))} />
      <Route path="*404" component={lazy(() => import('./errors/404'))} />
    </Router>
  ),
  root || document.body,
)
