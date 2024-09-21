import { Show } from 'solid-js';
import type {
  BsDatePickerOnChangeEvent,
  BsDatePickerProps,
} from './date-picker.d';

let debounceOnInput: number | null;

function onInput(
  event: BsDatePickerOnChangeEvent,
  callback?: (value: string) => void,
) {
  if (!callback) {
    return;
  }

  if (debounceOnInput) {
    clearTimeout(debounceOnInput);
  }

  debounceOnInput = setTimeout(() => {
    onChange(event, callback);
    debounceOnInput = null;
  }, 300);
}

function onChange(
  event: BsDatePickerOnChangeEvent,
  callback?: (value: string) => void,
) {
  if (!callback) {
    return;
  }

  event.stopPropagation();
  const target = event.target || event.currentTarget || { value: '' };
  callback(target.value);
}

export function BsDatePicker(props: BsDatePickerProps) {
  return (
    <label class="form-control w-full">
      <div class="label">
        <Show when={props.label}>
          <span class="w-full max-w-xs">{props.label}</span>
        </Show>
        <input
          class="input input-bordered w-full input-ghost"
          type={props.withTime ? 'datetime-local' : 'date'}
          placeholder={props.placeholder || ''}
          value={props.value || ''}
          onChange={(event) => onChange(event, props.onChange)}
          onInput={(event) => onInput(event, props.onChange)}
        />
      </div>
    </label>
  );
}
