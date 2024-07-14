import '@carbon/web-components/es/components/button/button';
import '@carbon/web-components/es/components/date-picker/index.js';


declare global {
  namespace JSX {
    interface MyElementAttributes {
      name: string;
    }
    interface CDSButton extends MyElementAttributes{
      type: 'text' | 'email'

    }

    interface IntrinsicElements {
      "cds-button": CDSButton;
      "cds-date-picker": CDSButton;
      "cds-date-picker-input": CDSButton;
    }

  }
}


