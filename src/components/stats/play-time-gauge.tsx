import { BadgeCheck, CircleAlert, CircleDashed, CircleX, type LucideProps } from 'lucide-solid'
import type { Component } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type { BsPlayTimeGaugeProps } from './play-time-gauge.d'

/** Ring outer diameter on screen (rem). 8rem = 128px, inside the 120-160px legibility window. */
const RING_SIZE_REM = 8
/** Ring stroke thickness (px). Decoupled from the daisyUI size/10 default for a steadier arc. */
const RING_THICKNESS_PX = 12

/** Quality fraction at or above which the concordance is considered reliable. */
const RELIABLE_THRESHOLD = 0.8
/** Quality fraction at or above which the concordance is still usable. Below it, fragile. */
const ACCEPTABLE_THRESHOLD = 0.5

/** Value shown when no gap can be scored (one source missing). */
const NO_QUALITY = '—'

/** Semantic tone of the reliability status, matching daisyUI color token names. */
export type QualityTone = 'success' | 'warning' | 'error' | 'neutral'

/** French label plus semantic tone for the textual status next to the ring. */
export interface QualityStatus {
  label: string
  tone: QualityTone
}

/**
 * Status word and tone for a quality fraction (0-1). Null means one source sum is empty and no
 * score exists: the neutral "Non calculée" state, never a fake zero-percent verdict.
 */
export function resolveQualityStatus(percentage: number | null): QualityStatus {
  if (percentage === null) {
    return { label: 'Non calculée', tone: 'neutral' }
  }
  if (percentage >= RELIABLE_THRESHOLD) {
    return { label: 'Fiable', tone: 'success' }
  }
  if (percentage >= ACCEPTABLE_THRESHOLD) {
    return { label: 'Acceptable', tone: 'warning' }
  }
  return { label: 'Fragile', tone: 'error' }
}

/** Rounded whole percentage of a 0-1 fraction, or the dash when there is no fraction. */
const formatPercent = (fraction: number | null): string =>
  fraction === null ? NO_QUALITY : `${Math.round(fraction * 100)} %`

/** Gap line: the relative difference between the two source totals. */
export const formatGapLabel = formatPercent

/** Minutes line: a rounded whole number of minutes with its unit. */
export function formatMinutes(minutes: number): string {
  return `${Math.round(minutes)} min`
}

/** Badge text and ring center: the curve-scored concordance percentage. */
export const formatQualityBadge = formatPercent

/** Ring, status and icon visuals per tone. One keyed record keeps the mapping compile-checked. */
const TONE_VISUALS: Record<QualityTone, { icon: Component<LucideProps>; textClass: string }> = {
  error: { icon: CircleX, textClass: 'text-error' },
  neutral: { icon: CircleDashed, textClass: 'text-base-content/50' },
  success: { icon: BadgeCheck, textClass: 'text-success' },
  warning: { icon: CircleAlert, textClass: 'text-warning' },
}

export function BsPlayTimeGauge(props: BsPlayTimeGaugeProps) {
  const status = () => resolveQualityStatus(props.quality.percentage)
  // The ring reads a unitless 0-100 value; an unscored match shows an empty ring, not a fake fill.
  const ringValue = () => (props.quality.percentage === null ? 0 : Math.round(props.quality.percentage * 100))

  return (
    <div>
      <h4 class="font-bold">Concordance feuille / événements</h4>

      <div class="mt-4 flex flex-wrap items-center gap-6">
        {/* biome-ignore lint/a11y/useSemanticElements: the native <meter> element cannot render the ring's centered label child */}
        <div
          aria-label="Fiabilité du temps de jeu"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={ringValue()}
          aria-valuetext={`${status().label} : ${formatQualityBadge(props.quality.percentage)}`}
          class={`radial-progress transition-none! print:scale-90 ${TONE_VISUALS[status().tone].textClass}`}
          role="meter"
          style={{
            '--size': `${RING_SIZE_REM}rem`,
            '--thickness': `${RING_THICKNESS_PX}px`,
            '--value': ringValue(),
          }}
        >
          {/* percentage is the curve-scored form of gap; the scoring curve lives in src/libs/stats/play-time.ts. */}
          <span class="font-bold text-3xl">{formatQualityBadge(props.quality.percentage)}</span>
        </div>

        <div class="flex flex-col gap-2">
          <span class={`flex items-center gap-2 font-bold text-xl ${TONE_VISUALS[status().tone].textClass}`}>
            <Dynamic aria-hidden="true" class="size-6" component={TONE_VISUALS[status().tone].icon} />
            {status().label}
          </span>

          <ul class="flex flex-col gap-1 text-sm">
            <li class="flex items-center gap-2">
              <span aria-hidden="true" class="size-2.5 rounded-full bg-primary" />
              Feuille : {formatMinutes(props.quality.tableTotalMinutes)}
            </li>
            <li class="flex items-center gap-2">
              <span aria-hidden="true" class="size-2.5 rounded-full bg-secondary" />
              Événements : {formatMinutes(props.quality.eventsTotalMinutes)}
            </li>
            <li class="flex items-center gap-2">
              Écart des totaux : <span class="badge badge-outline badge-sm">{formatGapLabel(props.quality.gap)}</span>
            </li>
            <li class="flex items-center gap-2 opacity-70">
              Cible théorique : {formatMinutes(props.theoreticalMinutes)}
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
