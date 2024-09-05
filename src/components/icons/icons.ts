import type { BsIconData, BsIconProps } from './icons.d'
import { DaisyVariant, getTheme } from '../../libs/daisy'
import { createStore } from 'solid-js/store'
import bsEventBus from '../../libs/event-bus'
import { clone } from '../../libs/utils'

const VARIANT: { [key: string]: { [key in DaisyVariant]: string } } = {
  default: {
    // light
    text: '#171929',
    primary: '#e8e8e8',
    "primary-content": '#171929',
    secondary: '#7a91b1',
    accent: '#66caa0',
    neutral: '#171929',
    "neutral-content": '#edf2f7',
    success: '#00a96d',
    warning: '#ffbd00',
    error: '#ff5760',
  },
  business: {
    text: '#cccccc',
    primary: '#1b1b1b',
    "primary-content": '#bdcdd0',
    secondary: '#7b8f99',
    accent: '#e86846',
    neutral: '#22272d',
    "neutral-content": '#bdcdd0',
    success: '#6ab086',
    warning: '#daad58',
    error: '#ab3e31',
  },
  aqua: {
    text: '#d3ddef',
    primary: '#2d5496',
    "primary-content": '#d3ddef',
    secondary: '#956eb2',
    accent: '#e8d48b',
    neutral: '#3b89c3',
    "neutral-content": '#09080d',
    success: '#15a34a',
    warning: '#d87605',
    error: '#ff7164',
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
  fill: VARIANT.default.text,
}

async function bsIconPropsToData(props: BsIconProps): Promise<BsIconData> {
  const theme = (await getTheme()) || 'default'
  const variant = VARIANT[theme] || VARIANT.default

  const data = {
    ...DEFAULT_ICON_DATA,
  }

  if (props.variant) {
    data.fill = variant[props.variant] || variant.text
  } else {
    data.fill = variant.text
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
