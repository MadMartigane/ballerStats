import { BsEventBusType } from './event-bus.d'

export class BsEventBus {
  #bus: Element = new Element()

  public addEventListener(
    eventType: BsEventBusType,
    callback: () => CustomEvent<unknown>,
  ) {
    this.#bus.addEventListener(eventType, callback, { capture: true })
  }
}

const bsEventBus = new BsEventBus()
export default bsEventBus
