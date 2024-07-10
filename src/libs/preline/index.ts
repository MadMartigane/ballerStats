import 'preline/preline'

import { IStaticMethods } from 'preline/preline'
declare global {
  interface Window {
    HSStaticMethods: IStaticMethods
  }
}

export * from './preline.d'
export * from './preline'

