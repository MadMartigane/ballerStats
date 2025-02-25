import type { BsToggleOnChangeEvent, BsToggleProps } from './toggle.d'

function onChange(event: BsToggleOnChangeEvent, callback?: (value: boolean) => void) {
  if (!callback) {
    return
  }

  event.stopPropagation()
  const target = event.target || event.currentTarget || { checked: true }
  callback(target.checked)
}

export default function BsToggle(props: BsToggleProps) {
  const size = props.size || 'base'

  return (
    <div class="w-full">
      <label class="w-full flex cursor-pointer">
        <div class="label w-1/3">{props.label}</div>

        <div class="w-2/3">
          <input
            type="checkbox"
            class={`toggle toggle-primary toggle-${size}`}
            checked={props.value}
            onChange={(event) => {
              onChange(event, props.onChange)
            }}
          />
        </div>
      </label>
    </div>
  )
}
