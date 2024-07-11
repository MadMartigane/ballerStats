import 'preline/preline'

import { IStaticMethods } from 'preline/preline'
declare global {
  interface Window {
    HSStaticMethods: IStaticMethods
  }
}

window.HSStaticMethods.autoInit()

export * from './preline.d'
export * from './preline'

