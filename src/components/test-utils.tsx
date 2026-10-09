import type { JSX } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach } from 'vitest'

export interface RenderResult {
  container: HTMLDivElement
  dispose: () => void
}

const activeRenders: RenderResult[] = []

/**
 * Mounts a Solid view into a fresh container appended to document.body.
 * Each render is disposed and its container removed after the test that made it.
 */
export function renderView(view: () => JSX.Element): RenderResult {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const disposeSolid = render(view, container)
  const result: RenderResult = {
    container,
    dispose: () => {
      disposeSolid()
      container.remove()
    },
  }
  activeRenders.push(result)
  return result
}

afterEach(() => {
  for (const result of activeRenders.splice(0)) {
    result.dispose()
  }
})
