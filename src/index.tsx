/* @refresh reload */
import './index.css'

import { For } from 'solid-js'
import { render } from 'solid-js/web'
import { Route, HashRouter } from '@solidjs/router'
import appBar from './components/app-bar'
import { NAVIGATION_MENU_ENTRIES } from './libs/menu'

import relAppleTouchIconUrl from '/img/apple-touch-icon.png'
import relIconUrl from '/img/favicon.ico'

const relAppleTouchIcon: HTMLLinkElement | null = document.querySelector('link[rel="apple-touch-icon"]');
if (relAppleTouchIcon) {
  relAppleTouchIcon.href = relAppleTouchIconUrl
}
const relIcon : HTMLLinkElement | null = document.querySelector('link[rel="icon"]');
if (relIcon) {
  relIcon.href = relIconUrl
}

const root = document.getElementById('app')

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  )
}


/*
    const location = useLocation();
    console.log("location: ", location);
const locationSig = new MadSignal(location.hash);
  createEffect(() => {
    locationSig.set(location.hash);
    console.log("effect location.pathname: ", location.pathname);
    console.log("effect location.hash: ", location.hash);

    window.HSStaticMethods.autoInit();
  });
*/

render(() => {
  return (
    <HashRouter root={appBar}>
      <For each={NAVIGATION_MENU_ENTRIES}>
        {menuItem => (
          <Route path={menuItem.path} component={menuItem.component} />
        )}
      </For>
    </HashRouter>
  )
}, root || document.body)
