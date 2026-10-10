import { createMemoryHistory, MemoryRouter, Route, type RouteSectionProps } from '@solidjs/router'
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

export interface RouterRenderOptions {
  /** Initial URL path, e.g. `/trombi/team-1`. Defaults to `/`. */
  path?: string
}

/**
 * Mounts a Solid view inside the real `@solidjs/router` MemoryRouter.
 * The view is rendered as the route component of a catch-all route, so
 * `<A>`, `useLocation` and `useParams` resolve against `options.path`.
 */
export function renderInRouter(
  view: (props: RouteSectionProps<unknown>) => JSX.Element,
  options: RouterRenderOptions = {}
): RenderResult {
  const initialPath = options.path ?? '/'
  const history = createMemoryHistory()
  history.set({ replace: true, scroll: false, value: initialPath })
  return renderView(() => (
    <MemoryRouter history={history}>
      <Route component={view} path="*" />
    </MemoryRouter>
  ))
}

/**
 * Installs the toast container and alert templates that `index.tsx` normally
 * provides, so `toast()` can run in jsdom. Returns a cleanup function.
 */
export function installToastHost(): () => void {
  const store = document.createElement('div')
  store.id = 'bs-template-store'
  for (const variant of ['info', 'success', 'warning', 'error']) {
    const template = document.createElement('div')
    template.id = `bs-template-store-alert-${variant}`
    const message = document.createElement('div')
    message.id = 'message'
    template.appendChild(message)
    store.appendChild(template)
  }
  const toastHost = document.createElement('div')
  toastHost.id = 'bs-global-toast'
  document.body.append(store, toastHost)
  return () => {
    store.remove()
    toastHost.remove()
  }
}

afterEach(() => {
  for (const result of activeRenders.splice(0)) {
    result.dispose()
  }
})
