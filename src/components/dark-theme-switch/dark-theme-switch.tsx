import { Moon, Sun, SunMoon } from 'lucide-solid'
import MadSignal from '../../libs/mad-signal'
import { getDarkThemeValue, setDarkMode } from '../../libs/preline'
import { getShortId } from '../../libs/utils'

function onThemeChange(event: Event) {
  console.log('onThemeChange event: ', event)

  const target: HTMLSelectElement | null = (event.target ||
    event.currentTarget) as HTMLSelectElement
  console.log('onThemeChange value: ', target.value)
  if (!target) {
    throw new Error(
      '<DarkThemeSwitch::onThemeChange()> Unable to get the target of "onChage" event.',
    )
  }

  setDarkMode(target.value)
}

export default function DarkThemeSwitch() {
  const id = `dark-theme-switch-${getShortId()}`
  const darkThemeValue: MadSignal<string | null> = new MadSignal(
    getDarkThemeValue(),
  )

  return (
    <div class="base-compnent">
      <div class="relative w-fit mx-0 my-4">
        <select
          id={id}
          class="peer p-4 pe-9 block w-full border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:focus:ring-neutral-600
  focus:pt-6
  focus:pb-2
  [&:not(:placeholder-shown)]:pt-6
  [&:not(:placeholder-shown)]:pb-2
  autofill:pt-6
  autofill:pb-2"
          onChange={event => {
            onThemeChange(event)
          }}
        >
          <option value="auto" selected={darkThemeValue.get() === 'auto'}>
            Auto (système)
          </option>
          <option value="dark" selected={darkThemeValue.get() === 'dark'}>
            Dark 2
          </option>
          <option value="light" selected={darkThemeValue.get() === 'light'}>
            Light
          </option>
        </select>
        <label
          for={id}
          class="absolute top-0 start-0 p-4 h-full truncate pointer-events-none transition ease-in-out duration-100 border border-transparent peer-disabled:opacity-50 peer-disabled:pointer-events-none
    peer-focus:text-xs
    peer-focus:-translate-y-1.5
    peer-focus:text-gray-500 dark:peer-focus:text-neutral-500
    peer-[:not(:placeholder-shown)]:text-xs
    peer-[:not(:placeholder-shown)]:-translate-y-1.5
    peer-[:not(:placeholder-shown)]:text-gray-500 dark:peer-[:not(:placeholder-shown)]:text-neutral-500 dark:text-neutral-500"
        >
          Dark mode
        </label>
      </div>
      {/* End Floating Select */}
    </div>
  )
}
