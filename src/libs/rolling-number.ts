import { type Accessor, createEffect, createSignal, onCleanup, untrack } from 'solid-js'

const DEFAULT_ANIMATION_DURATION_MS = 400
const MIN_STEP_MS = 40

/**
 * Creates a signal that animates from the previous value to the new value
 * whenever the source getter returns a different number.
 *
 * Animates from the old value to the new value by stepping through
 * intermediate integers. Each step has equal duration. Total animation
 * time does not exceed `durationMs`.
 *
 * A pending animation is cancelled if the source changes again before
 * completion, and the timer is released on owner disposal.
 *
 * @param source - A getter returning the current numeric value to track
 * @param durationMs - Animation duration in milliseconds (default: 400)
 * @returns The animated value signal getter
 */
export function createRollingNumber(
  source: () => number,
  durationMs = DEFAULT_ANIMATION_DURATION_MS
): Accessor<number> {
  const [value, setValue] = createSignal(source())
  let pendingTimeout: ReturnType<typeof setTimeout> | null = null

  function clearPending(): void {
    if (pendingTimeout !== null) {
      clearTimeout(pendingTimeout)
      pendingTimeout = null
    }
  }

  function animateTo(from: number, to: number): void {
    if (from === to) {
      return
    }
    clearPending()

    const diff = to - from
    const stepCount = Math.abs(diff)
    const direction = Math.sign(diff)

    // Calculate increment to fit total animation within durationMs.
    // For small deltas (1-3), increment=1 means each integer is visible.
    // For large deltas (e.g. 50+), increment skips some integers to stay within durationMs.
    const increment = Math.max(1, Math.ceil((stepCount * MIN_STEP_MS) / durationMs))
    const steps = Math.ceil(stepCount / increment)
    const stepDuration = durationMs / steps

    let step = 0

    function tick(): void {
      step += 1
      const displayValue = from + direction * Math.min(step * increment, stepCount)
      setValue(displayValue)

      if (displayValue === to) {
        pendingTimeout = null
      } else {
        pendingTimeout = setTimeout(tick, stepDuration)
      }
    }

    pendingTimeout = setTimeout(tick, stepDuration)
  }

  createEffect(() => {
    const next = source()
    animateTo(untrack(value), next)
  })

  onCleanup(() => {
    clearPending()
  })

  return value
}
