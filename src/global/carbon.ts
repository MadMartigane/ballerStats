import CDSButton from '@carbon/web-components/es/components/button/button.js'
import CDSCodeSnippet from '@carbon/web-components/es/components/code-snippet/code-snippet.js'

console.log('CDSButton: ', CDSButton)

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'cds-button': typeof CDSButton
      'cds-code-snippet': CDSCodeSnippet
    }
  }
}

import '@carbon/web-components/es/components/button/index.js'
import '@carbon/web-components/es/components/code-snippet/index.js'
