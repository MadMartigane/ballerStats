import { createEffect, For, Show } from 'solid-js'
import MadSignal from '../../libs/mad-signal'
import { NAVIGATION_MENU_ENTRIES } from '../../libs/menu'
import { RouteSectionProps, useLocation } from '@solidjs/router'

import logoSmallUrl from '/img/logo_small.png'
import { Bell, UserCog } from 'lucide-solid'

const isUserMenuOpen: MadSignal<boolean> = new MadSignal(false)
const isMainMenuOpen: MadSignal<boolean> = new MadSignal(false)
const isNotificationBoxOpen: MadSignal<boolean> = new MadSignal(false)
const currentHash: MadSignal<string> = new MadSignal('')

function isCurrentPath(candidatPath: string, currentPath: string) {
  return currentPath === candidatPath
}

function renderMasterTitle(currentPath: string) {
  const menuEntry = NAVIGATION_MENU_ENTRIES.find(entryCandidate =>
    isCurrentPath(entryCandidate.path, currentPath),
  )
  if (!menuEntry) {
    return NAVIGATION_MENU_ENTRIES[0].label
  }

  return menuEntry.label
}

function installEventHandlers() {
  const location = useLocation()

  createEffect(() => {
    currentHash.set(location.pathname)
  })
}

export default function appBar(props: RouteSectionProps<unknown>) {
  installEventHandlers()

  return (
    <div class="min-h-full">
      <nav class="bg-gray-800 sticky top-0">
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
                  <span class="absolute -inset-1.5"></span>
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
                      class="relative flex max-w-xs items-center rounded-full bg-gray-800 text-sm text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
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
                      class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                      role="menu"
                      aria-orientation="vertical"
                      aria-labelledby="user-menu-button"
                      tabindex="-1"
                    >
                      {/* Active: "bg-gray-100", Not Active: "" */}
                      <a
                        href="/user"
                        class="block px-4 py-2 text-sm text-gray-700"
                        role="menuitem"
                        tabindex="-1"
                        id="user-menu-item-0"
                      >
                        Your Profile
                      </a>
                      <a
                        href="/config"
                        class="block px-4 py-2 text-sm text-gray-700"
                        role="menuitem"
                        tabindex="-1"
                        id="user-menu-item-1"
                      >
                        Settings
                      </a>
                      <a
                        href="/"
                        class="block px-4 py-2 text-sm text-gray-700"
                        role="menuitem"
                        tabindex="-1"
                        id="user-menu-item-2"
                      >
                        Sign out
                      </a>
                    </div>
                  </Show>
                </div>
              </div>
            </div>
            <div class="-mr-2 flex md:hidden">
              {/* Mobile menu button */}
              <button
                type="button"
                class="relative inline-flex items-center justify-center rounded-md bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
                aria-controls="mobile-menu"
                aria-expanded="false"
              >
                <span class="absolute -inset-0.5"></span>
                <span class="sr-only">Open main menu</span>
                {/* Menu open: "hidden", Menu closed: "block" */}
                <svg
                  class="block h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
                {/* Menu open: "block", Menu closed: "hidden" */}
                <svg
                  class="hidden h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu, show/hide based on menu state. */}
        <div class="md:hidden" id="mobile-menu">
          <div class="space-y-1 px-2 pb-3 pt-2 sm:px-3">
            {/* Current: "bg-gray-900 text-white", Default: "text-gray-300 hover:bg-gray-700 hover:text-white" */}
            <a
              href="#"
              class="block rounded-md bg-gray-900 px-3 py-2 text-base font-medium text-white"
              aria-current="page"
            >
              Dashboard
            </a>
            <a
              href="#"
              class="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Team
            </a>
            <a
              href="#"
              class="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Projects
            </a>
            <a
              href="#"
              class="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Calendar
            </a>
            <a
              href="#"
              class="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Reports
            </a>
          </div>
          <div class="border-t border-gray-700 pb-3 pt-4">
            <div class="flex items-center px-5">
              <div class="flex-shrink-0">
                <img
                  class="h-10 w-10 rounded-full"
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                  alt=""
                />
              </div>
              <div class="ml-3">
                <div class="text-base font-medium leading-none text-white">
                  Tom Cook
                </div>
                <div class="text-sm font-medium leading-none text-gray-400">
                  tom@example.com
                </div>
              </div>
              <button
                type="button"
                class="relative ml-auto flex-shrink-0 rounded-full bg-gray-800 p-1 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800"
              >
                <span class="absolute -inset-1.5"></span>
                <span class="sr-only">View notifications</span>
                <svg
                  class="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
              </button>
            </div>
            <div class="mt-3 space-y-1 px-2">
              <a
                href="#"
                class="block rounded-md px-3 py-2 text-base font-medium text-gray-400 hover:bg-gray-700 hover:text-white"
              >
                Your Profile
              </a>
              <a
                href="#"
                class="block rounded-md px-3 py-2 text-base font-medium text-gray-400 hover:bg-gray-700 hover:text-white"
              >
                Settings
              </a>
              <a
                href="#"
                class="block rounded-md px-3 py-2 text-base font-medium text-gray-400 hover:bg-gray-700 hover:text-white"
              >
                Sign out
              </a>
            </div>
          </div>
        </div>
      </nav>

      <header class="bg-white shadow">
        <div class="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">
            {renderMasterTitle(String(currentHash.get()))}
          </h1>
        </div>
      </header>
      <main>
        <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {props.children}
        </div>
      </main>
    </div>
  )
}
