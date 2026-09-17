import { type RouteSectionProps, useLocation } from '@solidjs/router'
import { Menu, X } from 'lucide-solid'
import { createEffect, createMemo, For, Show } from 'solid-js'
import logoSmallUrl from '/img/logo_small.png'
import MadSignal from '../../libs/mad-signal'
import { NAVIGATION_MENU_ENTRIES } from '../../libs/menu/menu'
import type { MenuEntry } from '../../libs/menu/menu.d'
import { getNostromoLog, nostromoSync } from '../../libs/nostromo/nostromo-sync-store'
import { goTo } from '../../libs/utils/utils'
import BsNostromoLogMenu from '../bs-nostromo-sync/bs-nostromo-log-menu'
import BsNostromoStatusChip from '../bs-nostromo-sync/bs-nostromo-status-chip'

/** Entries shown by the dropdown: the store itself keeps the last fifty. */
const SYNC_MENU_LOG_LIMIT = 10

const isSyncMenuOpen: MadSignal<boolean> = new MadSignal(false)
const isMainMenuOpen: MadSignal<boolean> = new MadSignal(false)
const currentHash: MadSignal<string> = new MadSignal('')
const idInUrlPattern = /\/\d+/

function isCurrentPath(candidatPath: string, currentPath: string | null) {
  const cleanPath = currentPath?.replace(idInUrlPattern, '/:id')
  return cleanPath === candidatPath
}

function closeSyncMenu() {
  isSyncMenuOpen.set(false)
}

function toggleSyncMenu() {
  isSyncMenuOpen.set(!isSyncMenuOpen.get())
}

/**
 * Closes the panel when the focus leaves it: a keyboard user tabbing away and a
 * mouse user clicking elsewhere both leave the container. The chip itself is
 * inside the container, so its own click never closes the panel.
 */
function makeSyncMenuFocusOutHandler() {
  return (event: FocusEvent & { currentTarget: HTMLDivElement }) => {
    const next = event.relatedTarget
    if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
      closeSyncMenu()
    }
  }
}

/** Mobile entry point of the card: the chip and the link both open the dashboard. */
function goToAdministration() {
  closeMainMenu()
  goTo('/')
}

function closeMainMenu() {
  setTimeout(() => {
    isMainMenuOpen.set(false)
  }, 10)
}

function toggleMainMenu() {
  isMainMenuOpen.set(!isMainMenuOpen.get())
}

function _renderMasterTitle(currentPath: string | null) {
  let menuEntry = NAVIGATION_MENU_ENTRIES.find((entryCandidate) => isCurrentPath(entryCandidate.path, currentPath))

  if (!menuEntry) {
    menuEntry = NAVIGATION_MENU_ENTRIES.find((candidate) => candidate.path === '/*')
  }

  if (!menuEntry) {
    menuEntry = NAVIGATION_MENU_ENTRIES.at(-1)
  }

  if (!menuEntry) {
    // Unreachable: NAVIGATION_MENU_ENTRIES is a non-empty static array, so at least one fallback above matches.
    throw new Error('[app-bar] Cannot resolve a master title: NAVIGATION_MENU_ENTRIES is empty.')
  }

  const resolvedMenuEntry: MenuEntry = menuEntry

  return (
    <span>
      <span class="inline-flex px-1">{resolvedMenuEntry.icon()}</span>
      <span class="inline-flex">{resolvedMenuEntry.label}</span>
    </span>
  )
}

function installEventHandlers() {
  const location = useLocation()

  createEffect(() => {
    currentHash.set(location.pathname)
  })
}

export default function BsAppBar(props: RouteSectionProps<unknown>) {
  installEventHandlers()
  const mainMenuLabel = 'Menu principal'
  const syncLogEntries = createMemo(() => getNostromoLog().slice(-SYNC_MENU_LOG_LIMIT))

  return (
    <div class="min-h-full font-rajdhani">
      <nav class="sticky top-0 z-50 w-full flex-none bg-neutral/95 shadow-primary/60 shadow-xs supports-backdrop-blur:bg-neutral print:hidden">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="flex h-16 items-center justify-between">
            <div class="flex items-center">
              <div class="shrink-0">
                <a aria-current="page" href="#/">
                  <img alt="Logo Baller Stats" class="h-16 w-16" height={64} src={logoSmallUrl} width={64} />
                </a>
              </div>
              <div class="hidden md:block">
                <div class="ml-10 flex items-baseline space-x-4">
                  {/* Current: "bg-gray-900 text-white", Default: "text-gray-300 hover:bg-gray-700 hover:text-white" */}
                  <For each={NAVIGATION_MENU_ENTRIES}>
                    {(menuEntry) => (
                      <Show when={menuEntry.isMenuEntry}>
                        <a
                          aria-current="page"
                          class={`flex flex-row items-center gap-2 rounded-md px-3 py-2 font-medium text-sm ${String(currentHash.get()).endsWith(menuEntry.path) ? 'bg-primary text-primary-content' : 'text-neutral-content hover:bg-primary/60 hover:text-primary-content'}`}
                          href={menuEntry.path}
                        >
                          {menuEntry.icon()}
                          {menuEntry.label}
                        </a>
                      </Show>
                    )}
                  </For>
                </div>
              </div>
            </div>
            <div class="hidden md:block">
              <div class="ml-4 flex items-center md:ml-6">
                {/* Sync status: the chip opens the log panel and links to the Administration card */}
                <div class="relative ml-3" onFocusOut={makeSyncMenuFocusOutHandler()}>
                  <BsNostromoStatusChip
                    expanded={isSyncMenuOpen.get()}
                    hasMenu
                    onClick={toggleSyncMenu}
                    status={nostromoSync.status}
                  />

                  <Show when={isSyncMenuOpen.get()}>
                    <BsNostromoLogMenu entries={syncLogEntries()} onNavigate={closeSyncMenu} />
                  </Show>
                </div>
              </div>
            </div>
            <div class="-mr-2 flex gap-2 md:hidden">
              {/* Mobile menu button */}
              <div class="tooltip tooltip-bottom" data-tip={mainMenuLabel}>
                <button
                  aria-controls="mobile-menu"
                  aria-expanded="false"
                  aria-label={mainMenuLabel}
                  class="relative inline-flex items-center justify-center rounded-md bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-hidden focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
                  onBlur={closeMainMenu}
                  onClick={toggleMainMenu}
                  type="button"
                >
                  <span class="absolute -inset-0.5" />
                  {/* Menu open: "hidden", Menu closed: "block" */}
                  <Menu class={`${isMainMenuOpen.get() ? 'hidden' : 'block'} h-6 w-6`} />
                  {/* Menu open: "block", Menu closed: "hidden" */}
                  <X class={`${isMainMenuOpen.get() ? 'block' : 'hidden'} h-6 w-6`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile menu, show/hide based on menu state. */}
        <Show when={isMainMenuOpen.get()}>
          <div class="md:hidden" id="mobile-menu">
            <div class="space-y-1 px-2 pt-2 pb-3 sm:px-3">
              {/* Current: "bg-gray-900 text-white", Default: "text-gray-300 hover:bg-gray-700 hover:text-white" */}
              <For each={NAVIGATION_MENU_ENTRIES}>
                {(menuEntry) => (
                  <Show when={menuEntry.isMenuEntry}>
                    <a
                      aria-current="page"
                      class={`flex flex-row items-center gap-2 rounded-md px-3 py-2 font-medium text-base ${String(currentHash.get()).endsWith(menuEntry.path) ? 'bg-primary text-primary-content' : 'text-neutral-content hover:bg-primary/60 hover:text-primary-content'}`}
                      href={menuEntry.path}
                    >
                      {menuEntry.icon()}
                      {menuEntry.label}
                    </a>
                  </Show>
                )}
              </For>
            </div>
            <div class="border-gray-700 border-t pt-4 pb-3">
              <div class="mt-3 flex-row items-center gap-2 px-2">
                <BsNostromoStatusChip onClick={goToAdministration} status={nostromoSync.status} />
                <a
                  class="block rounded-md px-3 py-2 font-medium text-base text-neutral-content hover:bg-primary/60 hover:text-primary-content"
                  href="/"
                  onClick={closeMainMenu}
                >
                  Administration
                </a>
              </div>
            </div>
          </div>
        </Show>
      </nav>

      <main>
        <div class="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8 print:mx-0 print:max-w-none print:px-2">
          {props.children}
        </div>
      </main>
    </div>
  )
}
