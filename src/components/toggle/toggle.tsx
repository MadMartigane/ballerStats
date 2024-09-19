import type { BsToggleOnChangeEvent, BsToggleProps } from './toggle.d';

function onChange(
  event: BsToggleOnChangeEvent,
  callback?: (value: boolean) => void,
) {
  if (!callback) {
    return;
  }

  event.stopPropagation();
  const target = event.target || event.currentTarget || { checked: true };
  callback(target.checked);
}

export default function BsToggle(props: BsToggleProps) {
  const size = props.size || 'base';

  return (
    <div class="form-control w-full">
      <label class="label cursor-pointer">
        <span class="label-text">{props.label}</span>

        <input
          type="checkbox"
          class={`toggle toggle-primary toggle-${size}`}
          checked={props.value}
          onChange={(event) => {
            onChange(event, props.onChange);
          }}
        />
      </label>
    </div>
  );
}
