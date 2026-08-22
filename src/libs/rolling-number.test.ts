import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRollingNumber } from './rolling-number'

describe('createRollingNumber', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial source value immediately', () => {
    createRoot((dispose) => {
      const value = createRollingNumber(() => 42)
      expect(value()).toBe(42)
      dispose()
    })
  })

  it('animates and converges to the target value', async () => {
    await createRoot(async (dispose) => {
      const [source, setSource] = createSignal(0)
      const value = createRollingNumber(source, 400)
      expect(value()).toBe(0)

      setSource(5)
      // stepCount=5, increment=1, steps=5, stepDuration=80ms, total 400ms
      await vi.advanceTimersByTimeAsync(500)
      expect(value()).toBe(5)
      dispose()
    })
  })

  it('redirects from the current display value when interrupted mid-animation', async () => {
    await createRoot(async (dispose) => {
      const [source, setSource] = createSignal(0)
      const value = createRollingNumber(source, 400)
      expect(value()).toBe(0)

      setSource(100)
      // stepCount=100, increment=10, steps=10, stepDuration=40ms
      await vi.advanceTimersByTimeAsync(40)
      // First tick: displayValue = 0 + 1 * min(10, 100) = 10
      expect(value()).toBe(10)

      setSource(50)
      // New animation from current display value 10 to 50.
      // stepCount=40, increment=4, steps=10, stepDuration=40ms
      await vi.advanceTimersByTimeAsync(500)
      // Reaches target because direction is +1 and from=10: 10 + 1*min(40, 40) = 50
      expect(value()).toBe(50)
      dispose()
    })
  })

  it('onCleanup clears the pending timeout', async () => {
    // Placeholder satisfies TS definite assignment; createRoot runs its callback
    // synchronously, so getValue is the real accessor before any use below.
    let getValue: () => number = () => 0
    const dispose = createRoot((d) => {
      const [source, setSource] = createSignal(0)
      getValue = createRollingNumber(source, 400)
      setSource(100)
      return d
    })

    // First tick fires at 40ms, sets value to 10
    await vi.advanceTimersByTimeAsync(40)
    expect(getValue()).toBe(10)

    // Owner disposal triggers onCleanup, which clears the pending timeout
    dispose()

    // The animation must not continue; value stays where it was at disposal
    const valueAtDispose = getValue()
    await vi.advanceTimersByTimeAsync(2000)
    expect(getValue()).toBe(valueAtDispose)
  })
})
