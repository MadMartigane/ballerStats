import { For } from 'solid-js'
import { getTheme, setTheme, THEME_AUTO_KEY, THEMES } from '../../libs/daisy'
import MadSignal from '../../libs/mad-signal'
import { getShortId } from '../../libs/utils'

function onThemeChange(event: Event) {
  const target: HTMLSelectElement | null = (event.target || event.currentTarget) as HTMLSelectElement

  if (!target) {
    throw new Error('<DarkThemeSwitch::onThemeChange()> Unable to get the target of "onChage" event.')
  }

  setTheme(target.value)
}

export default function BsDarkThemeSwitch() {
  const id = `dark-theme-switch-${getShortId()}`
  const defaultTheme = Object.keys(THEMES)[0]
  const themeValue = new MadSignal(defaultTheme)

  getTheme().then((theme) => {
    themeValue.set(theme || defaultTheme)
  })

  return (
    <div class="relative mx-0 my-4 w-fit">
      <label class="w-full max-w-xs" for={id}>
        <select
          class="select select-bordered w-full max-w-xs"
          id={id}
          onChange={(event) => {
            onThemeChange(event)
          }}
        >
          <option selected={themeValue.get() === THEME_AUTO_KEY} value={THEME_AUTO_KEY}>
            Auto (système)
          </option>

          <For each={Object.keys(THEMES)}>
            {(name) => (
              <option selected={themeValue.get() === name} value={name}>
                {name}
              </option>
            )}
          </For>
        </select>
      </label>
    </div>
  )
}
