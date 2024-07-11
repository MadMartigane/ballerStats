import { PrelineComponentClasses } from "./preline.d"
import { PrelineBaseOptions } from "./preline.d"

export function getPrelineClass(newOptions: PrelineBaseOptions, classes: PrelineComponentClasses) {
  const classTab = [classes.common]

  switch (newOptions.variant) {
    case 'primary':
      classTab.push(classes.primary)
      break
    case 'secondary':
      classTab.push(classes.secondary)
      break
    case 'light':
      classTab.push(classes.light)
      break
    case 'success':
      classTab.push(classes.success)
      break
    case 'warning':
      classTab.push(classes.warning)
      break
    case 'error':
      classTab.push(classes.error)
      break
    default:
      classTab.push(classes.primary)
      break
  }

  switch (newOptions.size) {
    case 'sm':
      classTab.push(classes.sm)
      break
    case 'lg':
      classTab.push(classes.lg)
    default:
      classTab.push(classes.base)
      break
  }

  newOptions.pills
    ? classTab.push(classes.roundedFull)
    : classTab.push(classes.rounded)

  newOptions.wide
    ? classTab.push(classes.wideFull)
    : classTab.push(classes.wide)

  return classTab.join(' ')
}
