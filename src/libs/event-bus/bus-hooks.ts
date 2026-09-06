import { createSignal, onCleanup } from 'solid-js'
import bsEventBus from './event-bus'
import type { BsEventBusType } from './event-bus.d'

/** Subscribe to a bus event with automatic cleanup when the owner disposes. */
export function onBusEvent(eventType: BsEventBusType, handler: () => void) {
  bsEventBus.addEventListener(eventType, handler)
  onCleanup(() => bsEventBus.removeEventListener(eventType, handler))
}

/**
 * Reactive list driven by a bus event. Reads the getter once at creation and
 * re-reads it on every bus event of the given type plus on the optional local
 * notifier's signals (e.g. a draft source's `subscribe` for silent mutations).
 * Callers must pass a `getList` that is stable for the lifetime of the owner
 * (the source object is not swapped after mount).
 */
export function createBusList<T>(
  eventType: BsEventBusType,
  getList: () => T[],
  subscribe?: (listener: () => void) => () => void
): () => T[] {
  const [list, setList] = createSignal<T[]>(getList())
  onBusEvent(eventType, () => setList(getList()))
  if (subscribe) {
    onCleanup(subscribe(() => setList(getList())))
  }
  return list
}
