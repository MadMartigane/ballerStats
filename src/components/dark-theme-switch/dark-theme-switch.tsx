import { For } from 'solid-js'
import { THEMES, THEME_AUTO_KEY, getTheme, setTheme } from '../../libs/daisy'
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
  const themeValue = new MadSignal(THEMES.light)

  getTheme().then((theme) => {
    themeValue.set(theme || THEMES.light)
  })

  return (
    <div class="relative w-fit mx-0 my-4">
      <label for={id} class="form-control w-full max-w-xs">
        <select
          id={id}
          class="select select-bordered w-full max-w-xs"
          onChange={(event) => {
            onThemeChange(event)
          }}
        >
          <option value={THEME_AUTO_KEY} selected={themeValue.get() === THEME_AUTO_KEY}>
            Auto (système)
          </option>

          <For each={Object.keys(THEMES)}>
            {(name) => (
              <option value={THEMES[name]} selected={themeValue.get() === THEMES[name]}>
                {name}
              </option>
            )}
          </For>
        </select>
      </label>
    </div>
  )
}
