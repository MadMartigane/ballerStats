import { Show } from 'solid-js';
import { getShortId } from '../../libs/utils';
import type { BsInputOnChangeEvent, BsInputProps } from './input.d';

let debounceOnInput: number | null;

const defaultOptions: BsInputProps = {
  type: 'text',
  onBlur: () => {
    return;
  },
  onFocus: () => {
    return;
  },
};

function onInput(
  event: BsInputOnChangeEvent,
  callback?: (value: string) => void,
) {
  if (debounceOnInput) {
    clearTimeout(debounceOnInput);
  }

  debounceOnInput = setTimeout(() => {
    onChange(event, callback);
    debounceOnInput = null;
  }, 300);
}

function onChange(
  event: BsInputOnChangeEvent,
  callback?: (value: string) => void,
) {
  if (!callback) {
    return;
  }

  event.stopPropagation();
  const target = event.target || event.currentTarget || { value: '' };
  callback(target.value);
}

function adapter(options: BsInputProps): BsInputProps {
  const random = getShortId();
  const id = `hs-floating-gray-input-${options.type}-${random}`;

  return {
    ...defaultOptions,
    id,
    ...options,
  };
}

function renderDaisy(options: BsInputProps) {
  return (
    <label class="form-control w-full">
      <div class="label">
        <Show when={options.label}>
          <span class="w-full max-w-xs">{options.label}</span>
        </Show>
        <input
          class="input input-bordered w-full input-ghost"
          type={options.type}
          placeholder={options.placeholder}
          value={options.value || ''}
          onChange={(event) => onChange(event, options.onChange)}
          onInput={(event) => onInput(event, options.onChange)}
        />
      </div>
    </label>
  );
}

export default function BsInput(options: BsInputProps) {
  const newOpions = adapter(options);

  return renderDaisy(newOpions);
}
