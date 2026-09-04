import type { BsToggleOnChangeEvent, BsToggleProps } from './toggle.d'

function onChange(event: BsToggleOnChangeEvent, callback?: (value: boolean) => void) {
  if (!callback) {
    return
  }

  event.stopPropagation()
  const target = event.target || event.currentTarget || { checked: true }
  callback(target.checked)
}

function makeToggleChangeHandler(callback: BsToggleProps['onChange']) {
  return (event: BsToggleOnChangeEvent) => {
    onChange(event, callback)
  }
}

export default function BsToggle(props: BsToggleProps) {
  const size = props.size || 'base'

  return (
    <div class="w-full">
      <label class="flex w-full cursor-pointer">
        <div class="label w-1/3">{props.label}</div>

        <div class="w-2/3">
          <input
            checked={props.value}
            class={`toggle toggle-primary toggle-${size}`}
            onChange={makeToggleChangeHandler(props.onChange)}
            type="checkbox"
          />
        </div>
      </label>
    </div>
  )
}
