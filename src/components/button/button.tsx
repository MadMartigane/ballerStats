import { ButtonOptions } from './button.d'
import { getPrelineClass, PrelineComponentClasses } from '../../libs/preline'

const defaultButtonOptions: ButtonOptions = {
  element: <span>button</span>,
  size: 'base',
  variant: 'primary',
  wide: false,
  pills: false,
  disabled: false,
}

const classes: PrelineComponentClasses = {
  common: 'text-sm font-semibold',
  rounded: 'rounded-lg',
  roundedFull: 'rounded-full',
  wide: '',
  wideFull: 'w-full',
  primary: 'border border-transparent bg-blue-600 text-white hover:bg-blue-900 disabled:opacity-50 disabled:pointer-events-none',
  secondary: 'border border-transparent bg-teal-100 text-teal-800 hover:bg-teal-200 disabled:opacity-50 disabled:pointer-events-none dark:hover:bg-teal-900 dark:text-teal-500 dark:hover:text-teal-400',
  light: 'border border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200 disabled:opacity-50 disabled:pointer-events-none dark:hover:bg-blue-900 dark:text-blue-400',
  success: 'border border-transparent bg-teal-500 text-white hover:bg-teal-700 disabled:opacity-50 disabled:pointer-events-none',
  warning: 'border border-transparent bg-yellow-500 text-white hover:bg-yellow-700 disabled:opacity-50 disabled:pointer-events-none',
  error: 'border border-transparent bg-red-500 text-white hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none',
  sm: 'py-1 px-2',
  base: 'py-3 px-4',
  lg: 'p-4 sm:p-5',
}

function adaptor(options: ButtonOptions) {
  const newOptions = {
    ...defaultButtonOptions,
    ...options,
  }

  const prelineClass = getPrelineClass({
    variant: newOptions.variant,
    size: newOptions.size,
    pills: newOptions.pills,
    wide: newOptions.wide
  }, classes)

  return {
    class: prelineClass,
    slotStart: newOptions.slotStart,
    element: newOptions.element,
    slotEnd: newOptions.slotEnd,
    onClick:
      newOptions.onClick ||
      function () {
        return
      },
    disabled: newOptions.disabled,
  }
}

export default function Button(options: ButtonOptions) {
  const data = adaptor(options)

  return (
    <button type="button" class={data.class} onClick={() => data.onClick()} disabled={data.disabled}>
      <span class="inline-flex items-end gap-2">
      {data.slotStart}
      {data.element}
      {data.slotEnd}
      </span>
    </button>
  )
}
