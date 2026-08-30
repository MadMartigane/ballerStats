import { onMount } from 'solid-js'
import { initAuth } from './auth'

/** Invisible component: loads the persisted PocketBase session once after mount. */
export default function AuthInit() {
  onMount(() => {
    initAuth()
  })

  return null
}
