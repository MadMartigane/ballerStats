import type { JSXElement } from 'solid-js';
import type { DaisyVariant } from '../daisy';

export type MenuEntry = {
  path: string;
  label: string;
  icon: (variant?: DaisyVariant) => JSXElement;
  isMenuEntry: boolean;
  component: () => JSXElement;
};
