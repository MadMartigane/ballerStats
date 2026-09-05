/* @refresh reload */
import './index.css'
import './global/daisy'
import './global/font-family'

import { HashRouter, Route } from '@solidjs/router'
import { CircleAlert, CircleCheckBig, Skull, TriangleAlert } from 'lucide-solid'
import { For, lazy, Suspense } from 'solid-js'
import { render } from 'solid-js/web'
import relAppleTouchIconUrl from '/img/apple-touch-icon.png'
import relIconUrl from '/img/favicon.ico'
import BsAppBar from './components/app-bar/app-bar'
import { NAVIGATION_MENU_ENTRIES } from './libs/menu/menu'

// DEV-only: lazy-load the demo seed initializer. The dynamic import expression
// is dead-code-eliminated when import.meta.env.DEV is statically false.
const DemoSeedInit = import.meta.env.DEV ? lazy(() => import('./components/demo/demo-seed-init')) : undefined

const relAppleTouchIcon: HTMLLinkElement | null = document.querySelector('link[rel="apple-touch-icon"]')
if (relAppleTouchIcon) {
  relAppleTouchIcon.href = relAppleTouchIconUrl
}
const relIcon: HTMLLinkElement | null = document.querySelector('link[rel="icon"]')
if (relIcon) {
  relIcon.href = relIconUrl
}

const root = document.getElementById('app')

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?'
  )
}

function renderTemplateStore() {
  return (
    <div class="hidden" id="bs-template-store">
      <div
        class="alert alert-info w-full max-w-[calc(100vw-2rem)] shadow-lg sm:w-auto sm:min-w-64 sm:max-w-md"
        id="bs-template-store-alert-info"
      >
        <CircleAlert />
        <span class="min-w-0 max-w-full break-words text-sm sm:text-base" id="message" />
      </div>
      <div
        class="alert alert-success w-full max-w-[calc(100vw-2rem)] shadow-lg sm:w-auto sm:min-w-64 sm:max-w-md"
        id="bs-template-store-alert-success"
      >
        <CircleCheckBig />
        <span class="min-w-0 max-w-full break-words text-sm sm:text-base" id="message" />
      </div>
      <div
        class="alert alert-warning w-full max-w-[calc(100vw-2rem)] shadow-lg sm:w-auto sm:min-w-64 sm:max-w-md"
        id="bs-template-store-alert-warning"
      >
        <TriangleAlert />
        <span class="min-w-0 max-w-full break-words text-sm sm:text-base" id="message" />
      </div>
      <div
        class="alert alert-error w-full max-w-[calc(100vw-2rem)] shadow-lg sm:w-auto sm:min-w-64 sm:max-w-md"
        id="bs-template-store-alert-error"
      >
        <Skull />
        <span class="min-w-0 max-w-full break-words text-sm sm:text-base" id="message" />
      </div>
    </div>
  )
}

render(
  () => (
    <>
      <HashRouter root={BsAppBar}>
        <For each={NAVIGATION_MENU_ENTRIES}>
          {(menuItem) => <Route component={menuItem.component} path={menuItem.path} />}
        </For>
      </HashRouter>
      <div
        class="toast toast-center toast-bottom z-[9999] w-full max-w-[100vw] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:w-auto sm:max-w-md sm:px-0 print:hidden"
        id="bs-global-toast"
      />
      {renderTemplateStore()}
      <Suspense>{DemoSeedInit && <DemoSeedInit />}</Suspense>
    </>
  ),
  root || document.body
)
