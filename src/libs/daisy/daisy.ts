const DS_PREF_THEME_STORAGE_KEY = 'daisy_theme'
const THEME_ATTRIBUTE = 'data-theme'
const THEME_HTML_TAG = 'html'

export const THEME_AUTO_KEY = 'auto'
export const THEMES: {[name: string]: string} = {
  light: 'bsLight',
  dark: 'business',
  aqua: 'aqua',
}

export function initTheme() {
  const html: HTMLHtmlElement | null = document.querySelector(THEME_HTML_TAG)

  if (!html) {
    throw new Error('[daisy::initDarkMode()] unable to find THE html element.')
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

    return
  }

  html.setAttribute(THEME_ATTRIBUTE, storedPreference)
}

export function setTheme(darkMode: string | null) {
  if (darkMode === null) {
    localStorage.setItem(DS_PREF_THEME_STORAGE_KEY, THEME_AUTO_KEY)
  } else {
    localStorage.setItem(DS_PREF_THEME_STORAGE_KEY, darkMode)
  }

  initTheme()
}

export function resetTheme() {
  setTheme(null)
}

export function getTheme() {
  initTheme()
  const storedPreference = localStorage.getItem(DS_PREF_THEME_STORAGE_KEY)
  if (storedPreference) {
    return storedPreference
  }

  const html: HTMLHtmlElement | null = document.querySelector(THEME_HTML_TAG)
  return html?.getAttribute(THEME_ATTRIBUTE)
}
