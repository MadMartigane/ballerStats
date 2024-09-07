import bsEventBus from "../event-bus"

const DS_PREF_THEME_STORAGE_KEY = 'daisy_theme'
const THEME_ATTRIBUTE = 'data-theme'
const THEME_HTML_TAG = 'html'

export const THEME_AUTO_KEY = 'auto'
export const THEMES: {[name: string]: string} = {
  light: 'corporate',
  dark: 'business',
  aqua: 'aqua',
}

export async function initTheme() {
  const html: HTMLHtmlElement | null = document.querySelector(THEME_HTML_TAG)

  if (!html) {
    throw new Error('[daisy::initTheme()] unable to find THE html element.')
  }

  const isSystemPreferDark = window.matchMedia(
    '(prefers-color-scheme: dark)',
  ).matches
  const storedPreference = localStorage.getItem(DS_PREF_THEME_STORAGE_KEY)

  if (!storedPreference || storedPreference === THEME_AUTO_KEY) {
    if (isSystemPreferDark) {
      html.setAttribute(THEME_ATTRIBUTE, THEMES.dark)
    } else {
      html.setAttribute(THEME_ATTRIBUTE, THEMES.light)
    }

    return Promise.resolve(html)
  }

  html.setAttribute(THEME_ATTRIBUTE, storedPreference)
  return Promise.resolve(html)
}

export async function setTheme(theme: string | null) {
  if (theme === null) {
    localStorage.setItem(DS_PREF_THEME_STORAGE_KEY, THEME_AUTO_KEY)
  } else {
    localStorage.setItem(DS_PREF_THEME_STORAGE_KEY, theme)
  }

  bsEventBus.dispatchEvent('BS::THEME::CHANGE')
  return initTheme()
}

export async function resetTheme() {
  return setTheme(null)
}

export async function getTheme() {
  const html = await initTheme()
  return html?.getAttribute(THEME_ATTRIBUTE)
}
