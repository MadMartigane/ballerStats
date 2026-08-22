import type { ThemeVibration } from './vibrator.d'

export const themeVibration: { [key in ThemeVibration]: number[] } = {
  double: [100, 50, 100],
  long: [400],
  single: [100],
}

export function vibrate(theme: ThemeVibration = 'single') {
  if (!navigator.vibrate) {
    console.log('[Vibrate] navigator.vibrate is not supported.')
    return
  }

  navigator.vibrate(themeVibration[theme])
}
