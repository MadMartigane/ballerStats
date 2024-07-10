export type PrelineComponentVariant =
  | 'primary'
  | 'secondary'
  | 'light'
  | 'success'
  | 'warning'
  | 'error'

export type PrelineComponentSize = 'sm' | 'base' | 'lg'

export type PrelineComponentClasses = {
  common: string
  rounded: string
  roundedFull: string
  wide: string
  wideFull: string
  primary: string
  secondary: string
  light: string
  success: string
  warning: string
  error: string
  sm: string
  base: string
  lg: string
}

export type PrelineBaseOptions = {
  variant?: PrelineComponentVariant
  size?: PrelineComponentSize
  pills?: boolean
  wide?: boolean
}
