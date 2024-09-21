import type { JSX, JSXElement } from 'solid-js';

export type BsSelectOnChangeEvent = Event & {
  currentTarget: HTMLSelectElement;
  target: HTMLSelectElement;
};
export type BsSelectData = { value: string; label?: string | JSXElement };

export type BsSelectProps = {
  id?: string;
  value?: string | null;
  datas: Array<BsSelectData>;
  label?: string;
  disabled?: boolean;
  default?: string | null;
  placeholder?: string | null;
  onValueChange?: (value: string) => void;
  onChange?: (
    event: Event & {
      currentTarget: HTMLSelectElement;
      target: HTMLSelectElement;
    },
  ) => void;
} & JSX.HTMLAttributes<HTMLSelectElement>;
