import { FwButton } from '@freshworks/crayons/dist/custom-elements/index'

console.log('FwButton: ', FwButton)

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'fw-button': typeof FwButton
    }
  }
}

// import '@freshworks/crayons/dist/esm/crayons.js'
// import '@freshworks/crayons/dist/crayons'
