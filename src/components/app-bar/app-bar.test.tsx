import { afterEach, describe, expect, it } from 'vitest'
import { NAVIGATION_MENU_ENTRIES } from '../../libs/menu/menu'
import { renderInRouter } from '../test-utils'
import BsAppBar from './app-bar'

const VISIBLE_ENTRIES = NAVIGATION_MENU_ENTRIES.filter((entry) => entry.isMenuEntry)
const USER_MENU_LABEL = 'Ouvrir le menu utilisateur'
const MAIN_MENU_LABEL = 'Menu principal'
const MENU_CLOSE_DELAY_MS = 10

function requireButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!button) {
    throw new Error(`Button "${label}" not found`)
  }
  return button
}

function desktopLinkFor(container: HTMLElement, path: string): HTMLAnchorElement | null {
  return container.querySelector<HTMLAnchorElement>(`.hidden.md\\:block a[href="${path}"]`)
}

/**
 * The open state of both menus is a module-level signal that only closes on a
 * deferred blur. Blur each toggle and wait out the close delay so no test
 * leaks an open menu into the next one.
 */
async function resetMenus(container: HTMLElement) {
  for (const label of [USER_MENU_LABEL, MAIN_MENU_LABEL]) {
    container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.dispatchEvent(new FocusEvent('blur'))
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, MENU_CLOSE_DELAY_MS * 2)
  })
}

describe('BsAppBar', () => {
  afterEach(async () => {
    await resetMenus(document.body)
  })

  it('renders one navigation link per visible menu entry', () => {
    const { container } = renderInRouter(BsAppBar)

    const links = container.querySelectorAll('.hidden.md\\:block .ml-10 a')
    expect(links).toHaveLength(VISIBLE_ENTRIES.length)
    for (const entry of VISIBLE_ENTRIES) {
      expect(desktopLinkFor(container, entry.path)?.textContent).toContain(entry.label)
    }
  })

  it('highlights the link matching the current route and not the others', () => {
    const [active, ...others] = VISIBLE_ENTRIES
    if (!active) {
      throw new Error('No visible menu entry')
    }
    const { container } = renderInRouter(BsAppBar, { path: active.path })

    const activeLink = desktopLinkFor(container, active.path)
    expect(activeLink?.className).toContain('bg-primary text-primary-content')
    for (const entry of others) {
      expect(desktopLinkFor(container, entry.path)?.className).not.toContain('bg-primary text-primary-content')
    }
  })

  it('shows the user menu only after its toggle is clicked', () => {
    const { container } = renderInRouter(BsAppBar)
    expect(container.querySelector('menu')).toBeNull()

    requireButton(container, USER_MENU_LABEL).click()

    const items = Array.from(container.querySelectorAll('menu a')).map((link) => link.getAttribute('href'))
    expect(items).toEqual(['/user', '/config'])
  })

  it('hides the user menu again on a second toggle click', () => {
    const { container } = renderInRouter(BsAppBar)
    requireButton(container, USER_MENU_LABEL).click()
    expect(container.querySelector('menu')).not.toBeNull()

    requireButton(container, USER_MENU_LABEL).click()

    expect(container.querySelector('menu')).toBeNull()
  })

  it('opens the mobile menu on the main menu toggle and lists the navigation entries', () => {
    const { container } = renderInRouter(BsAppBar)
    expect(container.querySelector('#mobile-menu')).toBeNull()

    requireButton(container, MAIN_MENU_LABEL).click()

    const mobile = container.querySelector('#mobile-menu')
    expect(mobile).not.toBeNull()
    const hrefs = Array.from(mobile?.querySelectorAll('a[href]') ?? []).map((link) => link.getAttribute('href'))
    for (const entry of VISIBLE_ENTRIES) {
      expect(hrefs).toContain(entry.path)
    }
  })

  it('hides the mobile menu again on a second main menu toggle click', () => {
    const { container } = renderInRouter(BsAppBar)
    requireButton(container, MAIN_MENU_LABEL).click()
    expect(container.querySelector('#mobile-menu')).not.toBeNull()

    requireButton(container, MAIN_MENU_LABEL).click()

    expect(container.querySelector('#mobile-menu')).toBeNull()
  })

  it('links the logo to the dashboard root', () => {
    const { container } = renderInRouter(BsAppBar)

    const logo = container.querySelector<HTMLAnchorElement>('nav a[aria-current="page"]')
    expect(logo?.getAttribute('href')).toBe('#/')
    expect(logo?.querySelector('img')?.getAttribute('alt')).toBe('Baller stats logo')
  })
})
