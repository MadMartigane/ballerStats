/*
import { ThemeVibration } from './vibrator.d'

export const themeVibration: { [theme: ThemeVibration]: Array<number> } = {
  single: [200],
  double: [200, 100, 200],
  long: [400]
}
*/

export function vibrate() {
  navigator.vibrate(200)
}
