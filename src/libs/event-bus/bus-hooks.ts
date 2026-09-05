import { createEffect, createSignal, onCleanup } from 'solid-js'
import bsEventBus from './event-bus'
import type { BsEventBusType } from './event-bus.d'

/** Subscribe to a bus event with automatic cleanup when the owner disposes. */
export function onBusEvent(eventType: BsEventBusType, handler: () => void) {
  bsEventBus.addEventListener(eventType, handler)
  onCleanup(() => bsEventBus.removeEventListener(eventType, handler))
}

/**
 * Reactive list driven by a bus event. Re-reads the getter whenever its reactive
 * dependencies change and on every bus event of the given type, so both
 * framework-free collections (bus events) and Solid signals (reactive getters)
 * stay in sync. An optional local notifier (e.g. a draft source's `subscribe`)
 * re-reads the list on local mutations that deliberately do not fire the bus.
 */
export function createBusList<T>(
  eventType: BsEventBusType,
  getList: () => T[],
  subscribe?: (listener: () => void) => () => void
): () => T[] {
  const [list, setList] = createSignal<T[]>(getList())
  createEffect(() => {
    setList(getList())
  })
  onBusEvent(eventType, () => setList(getList()))
  if (subscribe) {
    onCleanup(subscribe(() => setList(getList())))
  }
  return list
}
