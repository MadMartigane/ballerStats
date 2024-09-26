import { createStore } from 'solid-js/store'
import { type DaisyVariant, getTheme } from '../../libs/daisy'
import bsEventBus from '../../libs/event-bus'
import { clone } from '../../libs/utils'
import type { BsIconData, BsIconProps } from './icons.d'

const VARIANTS: { [key: string]: { [key in DaisyVariant]: string } } = {
  // light
  default: {
    text: '#171929',
    primary: '#e8e8e8',
    'primary-content': '#edf2f7',
    secondary: '#7a91b1',
    'secondary-content': '#edf2f7',
    accent: '#66caa0',
    'accent-content': '#edf2f7',
    neutral: '#171929',
    'neutral-content': '#edf2f7',
    success: '#00a96d',
    'success-content': '#000000',
    warning: '#ffbd00',
    'warning-content': '#edf2f7',
    error: '#ff5760',
    'error-content': '#000000',
  },
  // dark
  dracula: {
    text: '#cccccc',
    primary: '#1b1b1b',
    'primary-content': '#bdcdd0',
    secondary: '#7b8f99',
    'secondary-content': '#15040d',
    accent: '#e86846',
    'accent-content': '#000000',
    neutral: '#22272d',
    'neutral-content': '#bdcdd0',
    success: '#6ab086',
    'success-content': '#000000',
    warning: '#daad58',
    'warning-content': '#15040d',
    error: '#ab3e31',
    'error-content': '#000000',
  },
  aqua: {
    text: '#d3ddef',
    primary: '#2d5496',
    'primary-content': '#d3ddef',
    secondary: '#956eb2',
    'secondary-content': '#d3ddef',
    accent: '#e8d48b',
    'accent-content': '#d3ddef',
    neutral: '#3b89c3',
    'neutral-content': '#09080d',
    success: '#15a34a',
    'success-content': '#d3ddef',
    warning: '#d87605',
    'warning-content': '#d3ddef',
    error: '#ff7164',
    'error-content': '#d3ddef',
  },
}

const SIZE: { [key: string]: string } = {
  sx: '12px',
  sm: '18px',
  base: '24px',
  lg: '30px',
  xl: '36px',
  '2xl': '42px',
  '3xl': '48px',
  '4xl': '54px',
  '5xl': '60px',
  '6xl': '66px',
  '7xl': '72px',
  '8xl': '78px',
  '9xl': '84px',
}

const DEFAULT_ICON_DATA = {
  height: SIZE.base,
  width: SIZE.base,
  fill: VARIANTS.default.text,
}

async function bsIconPropsToData(props: BsIconProps): Promise<BsIconData> {
  const theme = (await getTheme()) || 'default'
  const variants = VARIANTS[theme] || VARIANTS.default

  const data = {
    ...DEFAULT_ICON_DATA,
  }

  if (props.variant) {
    data.fill = variants[props.variant] || variants.text
  } else {
    data.fill = variants.text
  }

  if (props.size) {
    data.width = SIZE[props.size]
    data.height = SIZE[props.size]
  }

  return data
}

export function bsIconPropsToDataStore(props: BsIconProps) {
  const data = clone(DEFAULT_ICON_DATA) as BsIconData
  const [store, setStore] = createStore(data)
  bsEventBus.addEventListener('BS::THEME::CHANGE', () => {
    bsIconPropsToData(props).then(data => {
      setStore(data)
    })
  })

  bsIconPropsToData(props).then(data => {
    setStore(data)
  })

  return store
}
