import { Timer } from 'lucide-solid'
import { Show } from 'solid-js'
import { PLAY_TIME_WEIGHT_CEILING, PLAY_TIME_WEIGHT_FLOOR } from '../../libs/stats/play-time'
import { formatMatchFormat, getTheoreticalPlayerMinutes } from '../../libs/team/match-format'
import { BsPlayTimeGauge, formatQualityBadge } from './play-time-gauge'
import type { BsPlayTimePanelProps } from './play-time-panel.d'

function renderLegend(theoreticalMinutes: number, format: BsPlayTimePanelProps['format']): string {
  const floorShare = Math.round(PLAY_TIME_WEIGHT_FLOOR * 100)
  const ceilingShare = Math.round(PLAY_TIME_WEIGHT_CEILING * 100)
  return `Estimation arrondie à la minute. Le poids de la feuille officielle est mesuré d'après sa propre fiabilité, borné entre ${floorShare} % et ${ceilingShare} %, le reste revenant au suivi du coach ; l'ensemble est ensuite aligné sur le total théorique de ${theoreticalMinutes} min (${formatMatchFormat(format)}).`
}

export function BsPlayTimePanel(props: BsPlayTimePanelProps) {
  const theoreticalMinutes = () => getTheoreticalPlayerMinutes(props.format)
  const measuredQuality = () => {
    const quality = props.summary.playTimeQuality
    if (quality === undefined || quality.table.totalMinutes + quality.events.totalMinutes <= 0) {
      return
    }
    return quality
  }

  return (
    <div>
      <h3 class="flex items-center gap-1 font-bold">
        <Timer />
        Temps de jeu
      </h3>

      <Show fallback={<p class="opacity-70">Aucun temps de jeu enregistré.</p>} when={measuredQuality()}>
        {(quality) => (
          <>
            {/* A4-portrait budget: the stats table above already fills the page with ~8 px of
                slack, so the two 128-px rings stay side by side at `print:grid-cols-2` to bound
                the panel height rather than stack and grow it. Each ring keeps its
                `print:scale-90` (see `BsPlayTimeGauge`) to absorb the remaining margin. */}
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
              <BsPlayTimeGauge
                dotClass="bg-primary"
                source={quality().table}
                theoreticalMinutes={theoreticalMinutes()}
                title="Feuille officielle"
              />
              <BsPlayTimeGauge
                dotClass="bg-secondary"
                source={quality().events}
                theoreticalMinutes={theoreticalMinutes()}
                title="Suivi du coach"
              />
            </div>

            <p class="mt-2 text-sm">
              Concordance des deux saisies :{' '}
              <span class="badge badge-outline badge-sm">{formatQualityBadge(quality().percentage)}</span>
            </p>
            <p class="mt-2 text-sm opacity-70">{renderLegend(theoreticalMinutes(), props.format)}</p>
          </>
        )}
      </Show>
    </div>
  )
}
