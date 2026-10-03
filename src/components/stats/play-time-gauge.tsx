import type { BsPlayTimeGaugeProps } from './play-time-gauge.d'

/** Value shown when no gap can be scored (one source missing). */
const NO_QUALITY = '—'
/** Marker triangle: 4px half-width, 8px tall; `rotate-180` flips it to point up. */
const MARKER_CLASS = 'w-0 border-x-4 border-b-8 border-x-transparent border-b-current'

/**
 * Track domain: the largest of the theoretical total and both source sums, floored
 * at 1 so the divisor is never zero. The events sum can exceed the theoretical on a
 * real fixture; showing that overflow beats hiding it.
 */
export function resolveGaugeDomain(
  theoreticalMinutes: number,
  tableTotalMinutes: number,
  eventsTotalMinutes: number
): number {
  return Math.max(theoreticalMinutes, tableTotalMinutes, eventsTotalMinutes, 1)
}

/** Position of `value` on the track as a percentage of the domain. */
export function toGaugePercentage(value: number, domain: number): number {
  return (value / domain) * 100
}

/** Badge text: a rounded whole percentage of the quality fraction, or the dash. */
export function formatQualityBadge(percentage: number | null): string {
  return percentage === null ? NO_QUALITY : `${Math.round(percentage * 100)} %`
}

export function BsPlayTimeGauge(props: BsPlayTimeGaugeProps) {
  const domain = () =>
    resolveGaugeDomain(props.theoreticalMinutes, props.quality.tableTotalMinutes, props.quality.eventsTotalMinutes)

  return (
    <div>
      <div class="flex items-center justify-between">
        <h4 class="font-bold">Concordance feuille / événements</h4>
        <span class="badge badge-outline">{formatQualityBadge(props.quality.percentage)}</span>
      </div>

      <div class="relative mt-4 h-10">
        <div class="absolute inset-x-0 top-1/2 border-base-content/40 border-b" />

        <div
          class="absolute top-1/2 h-1/2 border-base-content/60 border-l-2"
          style={{ left: `${toGaugePercentage(props.theoreticalMinutes, domain())}%` }}
        >
          <span class="absolute top-0 left-1 text-xs opacity-70">{Math.round(props.theoreticalMinutes)}</span>
        </div>

        <div
          class="absolute top-1/2 -translate-x-1/2 -translate-y-full"
          style={{ left: `${toGaugePercentage(props.quality.tableTotalMinutes, domain())}%` }}
        >
          <span class={`${MARKER_CLASS} block text-primary`} />
        </div>

        <div
          class="absolute top-1/2 -translate-x-1/2"
          style={{ left: `${toGaugePercentage(props.quality.eventsTotalMinutes, domain())}%` }}
        >
          <span class={`${MARKER_CLASS} block rotate-180 text-secondary`} />
        </div>
      </div>

      <p class="mt-2 text-sm opacity-70">
        {`Feuille : ${Math.round(props.quality.tableTotalMinutes)} min · Événements : ${Math.round(props.quality.eventsTotalMinutes)} min · Écart : ${
          props.quality.gap === null ? NO_QUALITY : `${Math.round(props.quality.gap * 100)} %`
        }`}
      </p>
    </div>
  )
}
