import { PrelineComponentClasses } from './preline.d'
import { PrelineBaseOptions } from './preline.d'
import { IStaticMethods } from 'preline/preline'

declare global {
  interface Window {
    HSStaticMethods: IStaticMethods
    HSSelect: {
      getInstance: (id: string) => { selectedItems: string[] }
    }
  }
}

const HS_PREF_THEME_STORAGE_KEY = 'hs_theme'

export function getPrelineClass(
  newOptions: PrelineBaseOptions,
  classes: PrelineComponentClasses,
) {
  const classTab = [classes.common]

  switch (newOptions.variant) {
    case 'primary':
      classTab.push(classes.primary)
      break
    case 'secondary':
      classTab.push(classes.secondary)
      break
    case 'light':
      classTab.push(classes.light)
      break
    case 'success':
      classTab.push(classes.success)
      break
    case 'warning':
      classTab.push(classes.warning)
      break
    case 'error':
      classTab.push(classes.error)
      break
    default:
      classTab.push(classes.primary)
      break
  }

  switch (newOptions.size) {
    case 'sm':
      classTab.push(classes.sm)
      break
    case 'lg':
      classTab.push(classes.lg)
    default:
      classTab.push(classes.base)
      break
  }

  newOptions.pills
    ? classTab.push(classes.roundedFull)
    : classTab.push(classes.rounded)

  newOptions.wide
    ? classTab.push(classes.wideFull)
    : classTab.push(classes.wide)

  return classTab.join(' ')
}

export function initDarkMode() {
  // This code should be added to <head>.
  // It's used to prevent page load glitches.
  const html: HTMLHtmlElement | null = document.querySelector('html')

  if (!html) {
    throw new Error(
      '[preline::initDarkMode()] unable to find THE html element.',
    )
  }

  const isLightOrAuto =
    localStorage.getItem(HS_PREF_THEME_STORAGE_KEY) === 'light' ||
    (localStorage.getItem(HS_PREF_THEME_STORAGE_KEY) === 'auto' &&
      !window.matchMedia('(prefers-color-scheme: dark)').matches)

  const isDarkOrAuto =
    localStorage.getItem(HS_PREF_THEME_STORAGE_KEY) === 'dark' ||
    (localStorage.getItem(HS_PREF_THEME_STORAGE_KEY) === 'auto' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (isLightOrAuto && html.classList.contains('dark')) {
    html.classList.remove('dark')
  }

  if (isDarkOrAuto && html.classList.contains('light')) {
    html.classList.remove('light')
  }

  if (isDarkOrAuto && !html.classList.contains('dark')) {
    html.classList.add('dark')
  }

  if (isLightOrAuto && !html.classList.contains('light')) {
    html.classList.add('light')
  }
}

export function setDarkMode(darkMode: string | null) {
  if (darkMode === null) {
    localStorage.setItem(HS_PREF_THEME_STORAGE_KEY, 'auto')
  } else {
    localStorage.setItem(HS_PREF_THEME_STORAGE_KEY, darkMode)
  }

  initDarkMode()
}

export function resetDarkMode() {
  setDarkMode(null)
}

export function getDarkThemeValue() {
  return localStorage.getItem(HS_PREF_THEME_STORAGE_KEY) || null
}

function prelineAutoInit(modules?: string[] | string) {
  if (modules) {
    window.HSStaticMethods.autoInit(modules)
    return
  }

  window.HSStaticMethods.autoInit(modules)
}

export function initPrelineLib(modules?: Array<string> | string) {
  setTimeout(prelineAutoInit, 0, modules)
}

export function getPrelineHSSelectInstance(id: string) {
  return window.HSSelect.getInstance(`#${id}`)
}
