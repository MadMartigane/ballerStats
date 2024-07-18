import { getShortId } from '../../libs/utils'
import { BsInputOnChangeEvent, BsInputProps } from './input.d'

let debounceOnInput: number | null;

const defaultOptions: BsInputProps = {
  type: 'text',
  onBlur: () => { return },
  onFocus: () => { return },
}

function onInput(event: BsInputOnChangeEvent, callback?: (value: string) => void) {
  if (debounceOnInput) {
    clearTimeout(debounceOnInput)
  }

  debounceOnInput = setTimeout(() => {
    onChange(event, callback)
    debounceOnInput = null
  }, 300)
}

function onChange(event: BsInputOnChangeEvent, callback?: (value: string) => void) {
  if (!callback) {
    return;
  }

  event.stopPropagation()
  const target = event.target || event.currentTarget || { value: ''}
  callback(target.value)
}

function adapter(options: BsInputProps): BsInputProps {
  const number = getShortId()
  const id = `hs-floating-gray-input-${options.type}-${number}`

  return {
    ...defaultOptions,
    id,
    ...options,
  }
}

function renderClassic(options: BsInputProps) {
  return (
    <div class="relative">
      <input
        type={options.type}
        id={options.id}
        class="peer p-4 block w-full border-gray-200 rounded-lg text-sm placeholder:text-transparent focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700 dark:text-white dark:focus:ring-neutral-600
    focus:pt-6
    focus:pb-2
    [&:not(:placeholder-shown)]:pt-6
    [&:not(:placeholder-shown)]:pb-2
    autofill:pt-6
    autofill:pb-2"
        placeholder={options.placeholder}
        onChange={(event) => onChange(event, options.onChange)}
        onInput={(event) => onInput(event, options.onChange)}
      />
      <label
        for={options.id}
        class="absolute top-0 start-0 p-4 h-full text-sm truncate pointer-events-none transition ease-in-out duration-100 border border-transparent  origin-[0_0] peer-disabled:opacity-50 peer-disabled:pointer-events-none
      peer-focus:scale-90
      peer-focus:translate-x-0.5
      peer-focus:-translate-y-1.5
      peer-focus:text-gray-500 dark:peer-focus:text-neutral-500
      peer-[:not(:placeholder-shown)]:scale-90
      peer-[:not(:placeholder-shown)]:translate-x-0.5
      peer-[:not(:placeholder-shown)]:-translate-y-1.5
      peer-[:not(:placeholder-shown)]:text-gray-500 dark:peer-[:not(:placeholder-shown)]:text-neutral-500 dark:text-white"
      >
        {options.label}
      </label>
    </div>
  )
}

export default function BsInput(options: BsInputProps) {
  const newOpions = adapter(options)

  return renderClassic(newOpions)
}
