/* biome-ignore-all lint/performance/noJsxPropsBind: SolidJS component bodies run once, so handler references are stable and this React re-render rule does not apply */
import { Minus, Plus, Timer, TimerOff } from 'lucide-solid'
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import { formatClockDisplay, getRemainingMs } from '../../libs/match/clock'
import type { BsMatchClockProps } from './match-clock.d'

const TICK_INTERVAL_MS = 100
const FINE_TICK_INTERVAL_MS = 50
const FINAL_MINUTE_MS = 60_000
const ONE_SECOND_MS = 1000
const OVERTIME_LABEL = 'Prol.'

export function BsMatchClock(props: BsMatchClockProps) {
  const [tick, setTick] = createSignal(Date.now())
  const remainingMs = () => getRemainingMs(props.clock, tick())
  const isFinalMinute = createMemo(() => props.clock.running && remainingMs() <= FINAL_MINUTE_MS)
  const periodNumbers = createMemo(() => Array.from({ length: props.periodCount }, (_, index) => index + 1))
  const isOvertimeCurrent = () => props.currentPeriod > props.periodCount
  const overtimeLabel = () =>
    isOvertimeCurrent() ? `Prol. ${props.currentPeriod - props.periodCount}` : OVERTIME_LABEL
  const startClock = () => props.onToggleRunning(true)
  const stopClock = () => props.onToggleRunning(false)
  const removeOneSecond = () => props.onAdjust(-ONE_SECOND_MS)
  const addOneSecond = () => props.onAdjust(ONE_SECOND_MS)
  const selectOvertime = () => props.onSelectPeriod(props.periodCount + 1)
  const selectPeriod = (event: MouseEvent & { currentTarget: HTMLButtonElement }) =>
    props.onSelectPeriod(Number(event.currentTarget.dataset.period))

  createEffect(() => {
    if (!props.clock.running) {
      return
    }
    const intervalMs = isFinalMinute() ? FINE_TICK_INTERVAL_MS : TICK_INTERVAL_MS
    const intervalId = setInterval(() => setTick(Date.now()), intervalMs)
    onCleanup(() => clearInterval(intervalId))
  })

  return (
    <div class="flex w-full flex-col gap-2 rounded-xs border border-neutral bg-base-200 p-2">
      <div class="flex items-center justify-center gap-3 md:flex-row">
        <Show fallback={<TimerOff class="flex-none" size={28} />} when={props.clock.running}>
          <Timer class="flex-none" size={28} />
        </Show>
        <span class="font-bold font-mono text-5xl tabular-nums" data-testid="clock-display">
          {formatClockDisplay(remainingMs())}
        </span>
      </div>

      <Show
        fallback={
          <button class="btn btn-xl btn-success w-full text-xl" onClick={startClock} type="button">
            <Timer size={32} />
            Reprise du jeu
          </button>
        }
        when={props.clock.running}
      >
        <button class="btn btn-xl btn-error w-full text-xl" onClick={stopClock} type="button">
          <TimerOff size={32} />
          Arrêt du jeu
        </button>
      </Show>

      <div class="flex flex-col items-center justify-between gap-2 md:flex-row">
        <div class="flex items-center gap-2">
          <button
            aria-label="Retirer une seconde"
            class="btn btn-square btn-lg"
            onClick={removeOneSecond}
            type="button"
          >
            <Minus size={20} />
          </button>
          <button aria-label="Ajouter une seconde" class="btn btn-square btn-lg" onClick={addOneSecond} type="button">
            <Plus size={20} />
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <For each={periodNumbers()}>
            {(period) => (
              <button
                aria-label={`Période ${period}`}
                aria-pressed={period === props.currentPeriod}
                class="btn btn-lg"
                classList={{
                  'btn-ghost': period !== props.currentPeriod,
                  'btn-primary': period === props.currentPeriod,
                }}
                data-period={period}
                onClick={selectPeriod}
                type="button"
              >
                {`P${period}`}
              </button>
            )}
          </For>
          <button
            aria-label="Prolongation"
            aria-pressed={isOvertimeCurrent()}
            class="btn btn-lg"
            classList={{
              'btn-ghost': !isOvertimeCurrent(),
              'btn-primary': isOvertimeCurrent(),
            }}
            onClick={selectOvertime}
            type="button"
          >
            {overtimeLabel()}
          </button>
        </div>
      </div>
    </div>
  )
}
