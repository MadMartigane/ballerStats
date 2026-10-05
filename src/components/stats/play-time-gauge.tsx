import { BadgeCheck, CircleAlert, CircleDashed, CircleX, type LucideProps } from 'lucide-solid'
import type { Component } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type { BsPlayTimeGaugeProps } from './play-time-gauge.d'

/** Ring outer diameter on screen (rem). 8rem = 128px, inside the 120-160px legibility window. */
const RING_SIZE_REM = 8
/** Ring stroke thickness (px). Decoupled from the daisyUI size/10 default for a steadier arc. */
const RING_THICKNESS_PX = 12

/**
 * Thresholds of the five-level score scale, highest first. They reuse the previous reliability
 * cuts (0.8 and 0.5) as the two confidence anchors and split the tail into readable bands, so the
 * score stays monotonic in the quality fraction.
 *
 * - Excellent at 95 % or more: the source total matches the theoretical target closely enough that
 *   its weight can be trusted without reservation.
 * - Bon from 80 %: the previous "reliable" cut, kept verbatim. A source this close to the target is
 *   trustworthy for weighting the play-time estimate.
 * - Correcte from 65 %: still usable for weighting, but a visible deviation deserves a mention.
 * - Médiocre from 50 %: the previous "acceptable" cut, kept verbatim. The source stays usable yet
 *   should not be leaned on.
 * - Mauvais below 50 %: the total is too far from the target to inform the estimate.
 */
const EXCELLENT_THRESHOLD = 0.95
const BON_THRESHOLD = 0.8
const CORRECTE_THRESHOLD = 0.65
const MEDIOCRE_THRESHOLD = 0.5

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
 * score exists: the neutral "Non calculée" state, never a fake zero score.
 */
export function resolveQualityStatus(percentage: number | null): QualityStatus {
  if (percentage === null) {
    return { label: 'Non calculée', tone: 'neutral' }
  }
  if (percentage >= EXCELLENT_THRESHOLD) {
    return { label: 'Excellent', tone: 'success' }
  }
  if (percentage >= BON_THRESHOLD) {
    return { label: 'Bon', tone: 'success' }
  }
  if (percentage >= CORRECTE_THRESHOLD) {
    return { label: 'Correcte', tone: 'warning' }
  }
  if (percentage >= MEDIOCRE_THRESHOLD) {
    return { label: 'Médiocre', tone: 'warning' }
  }
  return { label: 'Mauvais', tone: 'error' }
}

/**
 * Status of ONE measured source. Distinct from `resolveQualityStatus`, which words the
 * two-source concordance: a null per-source percentage means this source alone was not
 * measured, so the wording is "Non mesurée" rather than "Non calculée".
 */
export function resolveSourceStatus(percentage: number | null): QualityStatus {
  if (percentage === null) {
    return { label: 'Non mesurée', tone: 'neutral' }
  }
  return resolveQualityStatus(percentage)
}

/** Rounded whole percentage of a 0-1 fraction, or the dash when there is no fraction. */
const formatPercent = (fraction: number | null): string =>
  fraction === null ? NO_QUALITY : `${Math.round(fraction * 100)} %`

/** Gap line: the relative difference between the source total and the theoretical total. */
export const formatGapLabel = formatPercent

/**
 * Ring center and concordance badge: the curve-scored concordance as a bare 0-100 score.
 *
 * The percent sign is deliberately omitted so this score never reads as the real gap percentage
 * shown next to it. Both numbers come from the same quality fraction but answer different
 * questions, and only the gap badge is an actual percentage.
 */
const formatScore = (fraction: number | null): string =>
  fraction === null ? NO_QUALITY : `${Math.round(fraction * 100)}`

/** Minutes line: a rounded whole number of minutes with its unit. */
export function formatMinutes(minutes: number): string {
  return `${Math.round(minutes)} min`
}

/** Badge text and ring center: the curve-scored concordance, as a unitless 0-100 score. */
export const formatQualityBadge = formatScore

/** Ring, status and icon visuals per tone. One keyed record keeps the mapping compile-checked. */
const TONE_VISUALS: Record<QualityTone, { icon: Component<LucideProps>; textClass: string }> = {
  error: { icon: CircleX, textClass: 'text-error' },
  neutral: { icon: CircleDashed, textClass: 'text-base-content/50' },
  success: { icon: BadgeCheck, textClass: 'text-success' },
  warning: { icon: CircleAlert, textClass: 'text-warning' },
}

export function BsPlayTimeGauge(props: BsPlayTimeGaugeProps) {
  const status = () => resolveSourceStatus(props.source.percentage)
  // The ring reads a unitless 0-100 value; an unmeasured source shows an empty ring, never a fake fill.
  const ringValue = () => (props.source.percentage === null ? 0 : Math.round(props.source.percentage * 100))

  return (
    <div>
      <h4 class="flex items-center gap-2 font-bold">
        <span aria-hidden="true" class={`size-2.5 rounded-full ${props.dotClass}`} />
        {props.title}
      </h4>

      <div class="mt-4 flex flex-wrap items-center gap-6">
        {/* biome-ignore lint/a11y/useSemanticElements: the native <meter> element cannot render the ring's centered label child */}
        <div
          aria-label={`Fiabilité — ${props.title}`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={ringValue()}
          aria-valuetext={`${status().label} : Score ${formatQualityBadge(props.source.percentage)}`}
          class={`radial-progress transition-none! print:scale-90 ${TONE_VISUALS[status().tone].textClass}`}
          role="meter"
          style={{
            '--size': `${RING_SIZE_REM}rem`,
            '--thickness': `${RING_THICKNESS_PX}px`,
            '--value': ringValue(),
          }}
        >
          {/* score is the curve-scored form of gap; the scoring curve lives in src/libs/stats/play-time.ts. */}
          <span class="font-bold text-3xl">{formatQualityBadge(props.source.percentage)}</span>
          {/* the caption names the bare 0-100 value, which carries no unit of its own since the
              percent sign was dropped to keep it apart from the real gap percentage below. */}
          <span class="text-xs uppercase tracking-wide opacity-60">Score</span>
        </div>

        <div class="flex flex-col gap-2">
          <span class={`flex items-center gap-2 font-bold text-xl ${TONE_VISUALS[status().tone].textClass}`}>
            <Dynamic aria-hidden="true" class="size-6" component={TONE_VISUALS[status().tone].icon} />
            {status().label}
          </span>

          <ul class="flex flex-col gap-1 text-sm">
            {/* An unmeasured source has no meaningful total: a `0 min` beside "Non mesurée"
                would read as a measured zero, so the dash carries the missing value instead. */}
            <li>Total : {props.source.percentage === null ? NO_QUALITY : formatMinutes(props.source.totalMinutes)}</li>
            <li>
              Écart à la cible : <span class="badge badge-outline badge-sm">{formatGapLabel(props.source.gap)}</span>
            </li>
            <li class="opacity-70">Cible théorique : {formatMinutes(props.theoreticalMinutes)}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
