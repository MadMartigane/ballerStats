import { createSignal } from 'solid-js';

export default class MadSignal<T> {
  private signalGet: () => T;
  private signalSet: (value: T) => void;

  constructor(initialValue: T) {
    const [get, set] = createSignal(initialValue);
    this.signalGet = get;
    this.signalSet = set;
  }

  public set(value: T): void {
    this.signalSet(value);
  }

  public get(): T {
    return this.signalGet();
  }
}
