import type { ThemeVibration } from './vibrator.d'

export const themeVibration: { [key in ThemeVibration]: Array<number> } = {
  single: [100],
  double: [100, 50, 100],
  long: [400]
}

export function vibrate(theme: ThemeVibration = 'single') {
  navigator.vibrate(themeVibration[theme])
}
