import { createSignal } from 'solid-js'

export default class MadSignal<T> {
  private signalGet: (() => T) | null = null
  private signalSet: ((value: T) => void) | null = null

  constructor(initialValue: T) {
    ;[this.signalGet, this.signalSet] = createSignal(initialValue)
  }

  public set(value: T): void {
    if (!this.signalSet) {
      console.warn('[MadSignal] signal not ready yet.')
      return
    }

    this.signalSet(value)
  }

  public get(): T | null {
    if (!this.signalGet) {
      console.warn('[MadSignal] signal not ready yet.')
      return null
    }

    return this.signalGet()
  }
}
