import type { BsIconProps } from './icons.d'

const DEFAULT_ICON_DATA = {
  class: '',
  xmlns: 'http://www.w3.org/2000/svg',
  height: '24px',
  viewBox: '0 -960 960 960',
  width: '24px',
}

const CLASSES: {[key: string]: string} = {
  primary:
    'stroke-slate-200 dark:stroke-slate-800',
  secondary:
    'stroke-emerald-800 dark:text-teal-500',
  light:
    'stroke-sky-800 dark:text-blue-400',
  success:
    'stroke-slate-200 dark:stroke-slate-800',
  warning:
    'stroke-slate-200 dark:stroke-slate-800',
  error:
    'stroke-slate-200 dark:stroke-slate-800',
  sm: 'stroke-1',
  base: 'stroke-2',
  lg: 'stroke-3',
}

export function bsIconPropsToData(props: BsIconProps) {

  const data = {
    ...DEFAULT_ICON_DATA,
  }

  if (props.variant) {
    data.class += CLASSES[props.variant]
  }

  if (props.size) {
    data.class += CLASSES[props.size]
  }

  return data
}

