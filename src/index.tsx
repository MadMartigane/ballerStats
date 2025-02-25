/* @refresh reload */
import './index.css'
import './global/daisy'
import './global/font-family'

import { HashRouter, Route } from '@solidjs/router'
import { For } from 'solid-js'
import { render } from 'solid-js/web'
import BsAppBar from './components/app-bar'
import { NAVIGATION_MENU_ENTRIES } from './libs/menu'

import { CircleAlert, CircleCheckBig, Skull, TriangleAlert } from 'lucide-solid'
import relAppleTouchIconUrl from '/img/apple-touch-icon.png'
import relIconUrl from '/img/favicon.ico'

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
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  )
}

function renderTemplateStore() {
  return (
    <div class="hidden" id="bs-template-store">
      <div class="alert alert-info" id="bs-template-store-alert-info">
        <CircleAlert />
        <span class="inline-block min-w-64 text-center" id="message" />
      </div>
      <div class="alert alert-success" id="bs-template-store-alert-success">
        <CircleCheckBig />
        <span class="inline-block min-w-64 text-center" id="message" />
      </div>
      <div class="alert alert-warning" id="bs-template-store-alert-warning">
        <TriangleAlert />
        <span class="inline-block min-w-64 text-center" id="message" />
      </div>
      <div class="alert alert-error" id="bs-template-store-alert-error">
        <Skull />
        <span class="inline-block min-w-64 text-center" id="message" />
      </div>
    </div>
  )
}

render(() => {
  return (
    <>
      <HashRouter root={BsAppBar}>
        <For each={NAVIGATION_MENU_ENTRIES}>
          {(menuItem) => <Route path={menuItem.path} component={menuItem.component} />}
        </For>
      </HashRouter>
      <div class="toast toast-end toast-bottom" id="bs-global-toast" />
      {renderTemplateStore()}
    </>
  )
}, root || document.body)
