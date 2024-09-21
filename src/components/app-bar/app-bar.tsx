import { type RouteSectionProps, useLocation } from '@solidjs/router'
import { For, Show, createEffect } from 'solid-js'
import MadSignal from '../../libs/mad-signal'
import { NAVIGATION_MENU_ENTRIES } from '../../libs/menu'

import { Bell, Menu, UserCog, X } from 'lucide-solid'
import logoSmallUrl from '/img/logo_small.png'

const isUserMenuOpen: MadSignal<boolean> = new MadSignal(false)
const isMainMenuOpen: MadSignal<boolean> = new MadSignal(false)
const isNotificationBoxOpen: MadSignal<boolean> = new MadSignal(false)
const currentHash: MadSignal<string> = new MadSignal('')
const idInUrlPattern = /\/\d+/

function isCurrentPath(candidatPath: string, currentPath: string | null) {
  const cleanPath = currentPath?.replace(idInUrlPattern, '/:id')
  return cleanPath === candidatPath
}

function renderMasterTitle(currentPath: string | null) {
  let menuEntry = NAVIGATION_MENU_ENTRIES.find(entryCandidate =>
    isCurrentPath(entryCandidate.path, currentPath),
  )

  if (!menuEntry) {
    menuEntry = NAVIGATION_MENU_ENTRIES.find(
      candidate => candidate.path === '/*',
    )
  }

  if (!menuEntry) {
    menuEntry = NAVIGATION_MENU_ENTRIES[NAVIGATION_MENU_ENTRIES.length - 1]
  }

  return (
    <span>
      <span class="inline-flex px-1">{menuEntry.icon()}</span>
      <span class="inline-flex">{menuEntry.label}</span>
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

  return (
    <div class="min-h-full font-rajdhani">
      <nav class="sticky top-0 z-50 w-full flex-none supports-backdrop-blur:bg-neutral bg-neutral/95 shadow shadow-primary/60">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="flex h-16 items-center justify-between">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <a href="#/" aria-current="page">
                  <img
                    class="h-16 w-16"
                    src={logoSmallUrl}
                    alt="Baller stats logo"
                  />
                </a>
              </div>
              <div class="hidden md:block">
                <div class="ml-10 flex items-baseline space-x-4">
                  {/* Current: "bg-gray-900 text-white", Default: "text-gray-300 hover:bg-gray-700 hover:text-white" */}
                  <For each={NAVIGATION_MENU_ENTRIES}>
                    {menuEntry => (
                      <Show when={menuEntry.isMenuEntry}>
                        <a
                          href={menuEntry.path}
                          class={`flex flex-row items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${String(currentHash.get()).endsWith(menuEntry.path) ? 'bg-primary text-primary-content' : 'text-neutral-content hover:bg-primary/60 hover:text-primary-content'}`}
                          aria-current="page"
                        >
                          {menuEntry.icon(
                            `${String(currentHash.get()).endsWith(menuEntry.path) ? 'primary-content' : 'neutral-content'}`,
                          )}
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
                {/* Notifications button */}
                <button
                  type="button"
                  id="notifications-box-button"
                  class="relative rounded-full bg-gray-800 p-1 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
                  onClick={() => {
                    isNotificationBoxOpen.set(!isNotificationBoxOpen.get())
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      isNotificationBoxOpen.set(false)
                    }, 10)
                  }}
                >
                  <span class="absolute -top-1.5 text-amber-500" />
                  <span class="sr-only">Afficher les notifications</span>
                  <Bell />
                </button>

                {/* Notifications dropdown */}
                <Show when={isNotificationBoxOpen.get()}>
                  <menu
                    id="notifications-box"
                    class="absolute right-1 top-16 mt-1 z-10 p-6 w-72 origin-top-right rounded-md bg-gray-800 text-gray-400 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                    aria-orientation="vertical"
                    aria-labelledby="notifications-box-button"
                    tabindex="-1"
                  >
                    Aucune notification
                  </menu>
                </Show>

                {/* Profile dropdown */}
                <div class="relative ml-3">
                  <div>
                    <button
                      type="button"
                      class="relative rounded-full bg-gray-800 p-1 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
                      id="user-menu-button"
                      aria-expanded="false"
                      aria-haspopup="true"
                      onClick={() => {
                        isUserMenuOpen.set(!isUserMenuOpen.get())
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          isUserMenuOpen.set(false)
                        }, 10)
                      }}
                    >
                      <span class="absolute -inset-1.5" />
                      <span class="sr-only">Open user menu</span>
                      <UserCog size="24" />
                    </button>
                  </div>

                  {/*
                      Dropdown menu, show/hide based on menu state.

                      Entering: "transition ease-out duration-100"
                        From: "transform opacity-0 scale-95"
                        To: "transform opacity-100 scale-100"
                      Leaving: "transition ease-in duration-75"
                        From: "transform opacity-100 scale-100"
                        To: "transform opacity-0 scale-95"
                    */}
                  <Show when={isUserMenuOpen.get()}>
                    <menu
                      class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-slate-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                      aria-orientation="vertical"
                      aria-labelledby="user-menu-button"
                      tabindex="-1"
                    >
                      {/* Active: "bg-gray-100", Not Active: "" */}
                      <a
                        href="/user"
                        class="block rounded-md px-3 py-2 text-base font-medium text-slate-100 hover:bg-slate-700 hover:text-white"
                        role="menuitem"
                        tabindex="-1"
                        id="user-menu-item-0"
                      >
                        Mon Profile
                      </a>
                      <a
                        href="/config"
                        class="block rounded-md px-3 py-2 text-base font-medium text-slate-100 hover:bg-slate-700 hover:text-white"
                        role="menuitem"
                        tabindex="-1"
                        id="user-menu-item-1"
                      >
                        Configuration
                      </a>
                    </menu>
                  </Show>
                </div>
              </div>
            </div>
            <div class="-mr-2 flex gap-2 md:hidden">
              {/* Notifications button (mobile) */}
              <button
                type="button"
                id="notifications-box-button"
                class="relative rounded-full bg-gray-800 p-2 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
                onClick={() => {
                  isNotificationBoxOpen.set(!isNotificationBoxOpen.get())
                }}
                onBlur={() => {
                  setTimeout(() => {
                    isNotificationBoxOpen.set(false)
                  }, 10)
                }}
              >
                <span class="absolute -top-1.5 text-amber-500" />
                <span class="sr-only">Afficher les notifications</span>
                <Bell />
              </button>

              {/* Notifications dropdown (mobile) */}
              <Show when={isNotificationBoxOpen.get()}>
                <menu
                  id="notifications-box"
                  class="absolute right-1 top-16 mt-1 z-10 p-6 w-72 origin-top-right rounded-md bg-gray-800 text-gray-400 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                  aria-orientation="vertical"
                  aria-labelledby="notifications-box-button"
                  tabindex="-1"
                >
                  Aucune notification
                </menu>
              </Show>

              {/* Mobile menu button */}
              <button
                type="button"
                class="relative inline-flex items-center justify-center rounded-md bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
                aria-controls="mobile-menu"
                aria-expanded="false"
                onClick={() => {
                  isMainMenuOpen.set(!isMainMenuOpen.get())
                }}
                onBlur={() =>
                  setTimeout(() => {
                    isMainMenuOpen.set(false)
                  }, 10)
                }
              >
                <span class="absolute -inset-0.5" />
                <span class="sr-only">
                  Ouverture menu principale, version mobile
                </span>
                {/* Menu open: "hidden", Menu closed: "block" */}
                <Menu
                  class={`${isMainMenuOpen.get() ? 'hidden' : 'block'} h-6 w-6`}
                />
                {/* Menu open: "block", Menu closed: "hidden" */}
                <X
                  class={`${isMainMenuOpen.get() ? 'block' : 'hidden'} h-6 w-6`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu, show/hide based on menu state. */}
        <Show when={isMainMenuOpen.get()}>
          <div class="md:hidden" id="mobile-menu">
            <div class="space-y-1 px-2 pb-3 pt-2 sm:px-3">
              {/* Current: "bg-gray-900 text-white", Default: "text-gray-300 hover:bg-gray-700 hover:text-white" */}
              <For each={NAVIGATION_MENU_ENTRIES}>
                {menuEntry => (
                  <Show when={menuEntry.isMenuEntry}>
                    <a
                      href={menuEntry.path}
                      class={`flex flex-row items-center gap-2 rounded-md px-3 py-2 text-base font-medium ${String(currentHash.get()).endsWith(menuEntry.path) ? 'bg-primary text-primary-content' : 'text-neutral-content hover:bg-primary/60 hover:text-primary-content'}`}
                      aria-current="page"
                    >
                      {menuEntry.icon(
                        `${String(currentHash.get()).endsWith(menuEntry.path) ? 'primary-content' : 'neutral-content'}`,
                      )}
                      {menuEntry.label}
                    </a>
                  </Show>
                )}
              </For>
            </div>
            <div class="border-t border-gray-700 pb-3 pt-4">
              <div class="mt-3 space-y-1 px-2">
                <a
                  href="/user"
                  class="block rounded-md px-3 py-2 text-base font-medium text-neutral-content hover:bg-primary/60 hover:text-primary-content"
                >
                  Mon Profile
                </a>
                <a
                  href="/config"
                  class="block rounded-md px-3 py-2 text-base font-medium text-neutral-content hover:bg-primary/60 hover:text-primary-content"
                >
                  Configuration
                </a>
              </div>
            </div>
          </div>
        </Show>
      </nav>

      <main>
        <div class="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          {props.children}
        </div>
      </main>
    </div>
  )
}
