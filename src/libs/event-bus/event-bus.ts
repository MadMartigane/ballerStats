import type { BsEventBusType } from './event-bus.d'

export class BsEventBus {
  #bus: Element = document.createElement('div')

  public addEventListener(eventType: BsEventBusType, callback: () => void) {
    this.#bus.addEventListener(eventType, callback, { capture: true })
  }

  public removeEventListener(eventType: BsEventBusType, callback: () => void) {
    this.#bus.removeEventListener(eventType, callback, { capture: true })
  }

  public dispatchEvent(eventType: BsEventBusType, data: unknown | null = null) {
    const event = new CustomEvent(eventType, { detail: data })
    this.#bus.dispatchEvent(event)
  }
}

const bsEventBus = new BsEventBus()
export default bsEventBus
