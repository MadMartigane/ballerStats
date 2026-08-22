import { createSignal } from 'solid-js'

export default class MadSignal<T> {
  private readonly signalGet: () => T
  private readonly signalSet: (value: T) => void

  constructor(initialValue: T) {
    const [get, set] = createSignal(initialValue)
    this.signalGet = get
    this.signalSet = set
  }

  set(value: T): void {
    this.signalSet(value)
  }

  get(): T {
    return this.signalGet()
  }
}
