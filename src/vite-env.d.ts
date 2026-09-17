/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base url of the Nostromo backend; undefined when the app runs without one. */
  readonly VITE_NOSTROMO_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
