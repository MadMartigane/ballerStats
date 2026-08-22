const DS_PREF_THEME_STORAGE_KEY = 'daisy_theme'
const THEME_ATTRIBUTE = 'data-theme'
const THEME_HTML_TAG = 'html'

export const THEME_AUTO_KEY = 'auto'
export const THEMES: { [name: string]: string } = {
  corporate: 'corporate',
  dark: 'dark',
  dim: 'dim',
  emerald: 'emerald',
  pastel: 'pastel',
}

/** Display order for the theme dropdown; kept separate so THEMES can stay alphabetically sorted. */
export const THEME_ORDER = ['corporate', 'dim', 'emerald', 'pastel', 'dark'] as const

export async function initTheme() {
  const html: HTMLHtmlElement | null = document.querySelector(THEME_HTML_TAG)

  if (!html) {
    throw new Error('[daisy::initTheme()] unable to find THE html element.')
  }

  const storedPreference = localStorage.getItem(DS_PREF_THEME_STORAGE_KEY)

  if (!storedPreference || storedPreference === THEME_AUTO_KEY) {
    html.removeAttribute(THEME_ATTRIBUTE)
  } else {
    html.setAttribute(THEME_ATTRIBUTE, storedPreference)
  }

  return await Promise.resolve(html)
}

export async function setTheme(theme: string | null) {
  if (theme === null) {
    localStorage.setItem(DS_PREF_THEME_STORAGE_KEY, THEME_AUTO_KEY)
  } else {
    localStorage.setItem(DS_PREF_THEME_STORAGE_KEY, theme)
  }

  return await initTheme()
}

export async function resetTheme() {
  return await setTheme(null)
}

export async function getTheme() {
  const html = await initTheme()
  return html?.getAttribute(THEME_ATTRIBUTE)
}
