import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchClockData } from '../../libs/match/clock.d'
import { renderView } from '../test-utils'
import { BsMatchClock } from './match-clock'

const FULL_PERIOD_MS = 10 * 60_000
const STOPPED_CLOCK: MatchClockData = { anchorEpochMs: 0, remainingMs: FULL_PERIOD_MS, running: false }
const T0 = 1_700_000_000_000

interface Handlers {
  onAdjust: ReturnType<typeof vi.fn<(deltaMs: number) => void>>
  onSelectPeriod: ReturnType<typeof vi.fn<(period: number) => void>>
  onToggleRunning: ReturnType<typeof vi.fn<(nextRunning: boolean) => void>>
}

function makeHandlers(): Handlers {
  return {
    onAdjust: vi.fn<(deltaMs: number) => void>(),
    onSelectPeriod: vi.fn<(period: number) => void>(),
    onToggleRunning: vi.fn<(nextRunning: boolean) => void>(),
  }
}

function renderClock(overrides: Partial<Parameters<typeof BsMatchClock>[0]> = {}, handlers = makeHandlers()) {
  const result = renderView(() => (
    <BsMatchClock
      clock={overrides.clock ?? STOPPED_CLOCK}
      currentPeriod={overrides.currentPeriod ?? 1}
      onAdjust={handlers.onAdjust}
      onSelectPeriod={handlers.onSelectPeriod}
      onToggleRunning={handlers.onToggleRunning}
      periodCount={overrides.periodCount ?? 4}
    />
  ))
  return { ...result, handlers }
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === text)
  if (!found) {
    throw new Error(`Button "${text}" not found`)
  }
  return found
}

function display(container: HTMLElement): string | null {
  return container.querySelector('[data-testid="clock-display"]')?.textContent ?? null
}

function buttonByLabel(container: HTMLElement, label: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!found) {
    throw new Error(`Button with aria-label "${label}" not found`)
  }
  return found
}

function click(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('BsMatchClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders the full period time and the resume control when stopped', () => {
    const { container, dispose } = renderClock()
    expect(display(container)).toBe('10:00')
    expect(buttonByText(container, 'Reprise du jeu').className).toContain('btn-success')
    dispose()
  })

  it('renders the stop control with btn-error when running', () => {
    const { container, dispose } = renderClock({
      clock: { anchorEpochMs: T0, remainingMs: FULL_PERIOD_MS, running: true },
    })
    const stop = buttonByText(container, 'Arrêt du jeu')
    expect(stop.className).toContain('btn-error')
    expect(stop.className).toContain('btn-lg')
    dispose()
  })

  it('decreases the display while running and switches to tenths under the final minute', () => {
    const runningClock: MatchClockData = { anchorEpochMs: T0, remainingMs: 61_000, running: true }
    const { container, dispose } = renderClock({ clock: runningClock })
    expect(display(container)).toBe('01:01')

    vi.setSystemTime(T0 + 1900)
    vi.advanceTimersByTime(100)
    expect(display(container)).toBe('59.0')

    vi.setSystemTime(T0 + 2400)
    vi.advanceTimersByTime(100)
    expect(display(container)).toBe('58.5')
    dispose()
  })

  it('calls onToggleRunning with true when the stopped control is clicked', () => {
    const { container, handlers, dispose } = renderClock()
    click(buttonByText(container, 'Reprise du jeu'))
    expect(handlers.onToggleRunning).toHaveBeenCalledExactlyOnceWith(true)
    dispose()
  })

  it('calls onToggleRunning with false when the running control is clicked', () => {
    const { container, handlers, dispose } = renderClock({
      clock: { anchorEpochMs: T0, remainingMs: FULL_PERIOD_MS, running: true },
    })
    click(buttonByText(container, 'Arrêt du jeu'))
    expect(handlers.onToggleRunning).toHaveBeenCalledExactlyOnceWith(false)
    dispose()
  })

  it('calls onAdjust with +1000 and -1000 exactly once per stepper click', () => {
    const { container, handlers, dispose } = renderClock()
    click(buttonByLabel(container, 'Ajouter une seconde'))
    expect(handlers.onAdjust).toHaveBeenCalledExactlyOnceWith(1000)
    handlers.onAdjust.mockClear()
    click(buttonByLabel(container, 'Retirer une seconde'))
    expect(handlers.onAdjust).toHaveBeenCalledExactlyOnceWith(-1000)
    dispose()
  })

  it('renders one chip per regulation period and highlights the current one', () => {
    const { container, dispose } = renderClock({ currentPeriod: 2 })
    const chips = ['P1', 'P2', 'P3', 'P4'].map((label) => buttonByText(container, label))
    expect(chips[1].className).toContain('btn-primary')
    expect(chips[0].className).toContain('btn-ghost')
    expect(chips[1].getAttribute('aria-pressed')).toBe('true')
    expect(chips[0].getAttribute('aria-pressed')).toBe('false')
    dispose()
  })

  it('calls onSelectPeriod with the 1-based index when a regulation chip is clicked', () => {
    const { container, handlers, dispose } = renderClock()
    click(buttonByText(container, 'P3'))
    expect(handlers.onSelectPeriod).toHaveBeenCalledExactlyOnceWith(3)
    dispose()
  })

  it('renders a single overtime chip labelled Prol. when no overtime is current', () => {
    const { container, dispose } = renderClock({ currentPeriod: 2 })
    const overtimeChips = Array.from(container.querySelectorAll('button')).filter((button) =>
      button.textContent?.trim().startsWith('Prol')
    )
    expect(overtimeChips).toHaveLength(1)
    expect(overtimeChips[0].textContent?.trim()).toBe('Prol.')
    expect(overtimeChips[0].className).toContain('btn-ghost')
    dispose()
  })

  it('calls onSelectPeriod with periodCount + 1 when the overtime chip is clicked', () => {
    const { container, handlers, dispose } = renderClock({ periodCount: 4 })
    click(buttonByLabel(container, 'Prolongation'))
    expect(handlers.onSelectPeriod).toHaveBeenCalledExactlyOnceWith(5)
    dispose()
  })

  it('shows the overtime index and highlights the overtime chip while an overtime is current', () => {
    const { container, dispose } = renderClock({ currentPeriod: 6, periodCount: 4 })
    const overtime = buttonByLabel(container, 'Prolongation')
    expect(overtime.textContent?.trim()).toBe('Prol. 2')
    expect(overtime.className).toContain('btn-primary')
    expect(overtime.getAttribute('aria-pressed')).toBe('true')
    expect(buttonByText(container, 'P4').className).toContain('btn-ghost')
    dispose()
  })

  it('exposes the expected aria attributes on steppers, chips and overtime', () => {
    const { container, dispose } = renderClock({ currentPeriod: 1 })
    expect(buttonByLabel(container, 'Retirer une seconde')).toBeTruthy()
    expect(buttonByLabel(container, 'Ajouter une seconde')).toBeTruthy()
    expect(buttonByLabel(container, 'Période 1').getAttribute('aria-pressed')).toBe('true')
    expect(buttonByLabel(container, 'Période 2').getAttribute('aria-pressed')).toBe('false')
    expect(buttonByLabel(container, 'Prolongation').getAttribute('aria-pressed')).toBe('false')
    dispose()
  })

  it('uses font-mono and tabular-nums on the display', () => {
    const { container, dispose } = renderClock()
    const displayElement = container.querySelector('[data-testid="clock-display"]')
    expect(displayElement?.classList.contains('font-mono')).toBe(true)
    expect(displayElement?.classList.contains('tabular-nums')).toBe(true)
    dispose()
  })

  it('clears its tick interval on teardown and never leaves timers behind', () => {
    const { dispose } = renderClock({ clock: { anchorEpochMs: T0, remainingMs: FULL_PERIOD_MS, running: true } })
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('starts no interval while stopped', () => {
    const { dispose } = renderClock()
    expect(vi.getTimerCount()).toBe(0)
    dispose()
  })
})
