import { createEffect, For, Show } from 'solid-js'
import MadSignal from '../../libs/mad-signal'
import { NAVIGATION_MENU_ENTRIES } from '../../libs/menu'
import { RouteSectionProps, useLocation } from '@solidjs/router'

import logoSmallUrl from '/img/logo_small.png'
import { Bell, Menu, UserCog, X } from 'lucide-solid'

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
    menuEntry = NAVIGATION_MENU_ENTRIES.find(candidate => candidate.path === '/*')
  }

  if (!menuEntry) {
    menuEntry = NAVIGATION_MENU_ENTRIES[NAVIGATION_MENU_ENTRIES.length -1];
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

    window.HSStaticMethods.autoInit()
  })
}

export default function BsAppBar(props: RouteSectionProps<unknown>) {
  installEventHandlers()

  return (
    <div class="min-h-full bg-slate-600">
      <nav class="sticky top-0 z-50 w-full backdrop-blur flex-none transition-colors duration-500 border-b border-slate-50/[0.06] supports-backdrop-blur:bg-slate-200/95 bg-slate-900/75">
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
                          class={`flex flex-row items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${String(currentHash.get()).endsWith(menuEntry.path) ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                          aria-current="page"
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
                  <span class="absolute -top-1.5 text-amber-500"></span>
                  <span class="sr-only">Afficher les notifications</span>
                  <Bell />
                </button>

                {/* Notifications dropdown */}
                <Show when={isNotificationBoxOpen.get()}>
                  <div
                    id="notifications-box"
                    class="absolute right-1 top-16 mt-1 z-10 p-6 w-72 origin-top-right rounded-md bg-gray-800 text-gray-400 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="notifications-box-button"
                    tabindex="-1"
                  >
                    Aucune notification
                  </div>
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
                      <span class="absolute -inset-1.5"></span>
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
                    <div
                      class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-slate-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                      role="menu"
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
                    </div>
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
                <span class="absolute -top-1.5 text-amber-500"></span>
                <span class="sr-only">Afficher les notifications</span>
                <Bell />
              </button>

              {/* Notifications dropdown (mobile) */}
              <Show when={isNotificationBoxOpen.get()}>
                <div
                  id="notifications-box"
                  class="absolute right-1 top-16 mt-1 z-10 p-6 w-72 origin-top-right rounded-md bg-gray-800 text-gray-400 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="notifications-box-button"
                  tabindex="-1"
                >
                  Aucune notification
                </div>
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
                <span class="absolute -inset-0.5"></span>
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
                      class={`flex flex-row items-center gap-2 rounded-md px-3 py-2 text-base font-medium ${currentHash.get() === menuEntry.path ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                      aria-current="page"
                    >
                      {menuEntry.icon()}
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
                  class="block rounded-md px-3 py-2 text-base font-medium text-gray-400 hover:bg-gray-700 hover:text-white"
                >
                  Mon Profile
                </a>
                <a
                  href="/config"
                  class="block rounded-md px-3 py-2 text-base font-medium text-gray-400 hover:bg-gray-700 hover:text-white"
                >
                  Configuration
                </a>
              </div>
            </div>
          </div>
        </Show>
      </nav>

      <header class="bg-white shadow dark:bg-sky-950">
        <div class="mx-auto max-w-7xl px-3 py-2 sm:px-4 lg:px-6">
          <h1 class="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-300">
            {renderMasterTitle(currentHash.get())}
          </h1>
        </div>
      </header>
      <main class="base-component min-h-screen">
        <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {props.children}
        </div>
      </main>
    </div>
  )
}
