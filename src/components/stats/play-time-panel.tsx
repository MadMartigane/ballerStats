import { Timer } from 'lucide-solid'
import { Show } from 'solid-js'
import { PLAY_TIME_TABLE_WEIGHT, PLAY_TIME_TOLERANCE } from '../../libs/stats/play-time'
import { getTheoreticalPlayerMinutes } from '../../libs/team/match-format'
import { BsPlayTimeGauge } from './play-time-gauge'
import type { BsPlayTimePanelProps } from './play-time-panel.d'

function renderLegend(theoreticalMinutes: number, format: BsPlayTimePanelProps['format']): string {
  const tableShare = Math.round(PLAY_TIME_TABLE_WEIGHT * 100)
  const eventsShare = 100 - tableShare
  const toleranceShare = Math.round(PLAY_TIME_TOLERANCE * 100)
  return `Estimation arrondie à la minute : ${tableShare} % de la feuille de match et ${eventsShare} % des entrées/sorties du coach. Quand les minutes recalculées s'écartent de plus de ${toleranceShare} % du total théorique de ${theoreticalMinutes} min (${format.periods} périodes × ${format.periodLengthMinutes} min × ${format.playersOnCourt} joueurs), elles sont rectifiées pour totaliser ce total théorique.`
}

export function BsPlayTimePanel(props: BsPlayTimePanelProps) {
  const theoreticalMinutes = () => getTheoreticalPlayerMinutes(props.format)
  const measuredQuality = () => {
    const quality = props.summary.playTimeQuality
    if (quality === undefined || quality.tableTotalMinutes + quality.eventsTotalMinutes <= 0) {
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
            <BsPlayTimeGauge quality={quality()} theoreticalMinutes={theoreticalMinutes()} />
            <p class="mt-2 text-sm opacity-70">{renderLegend(theoreticalMinutes(), props.format)}</p>
          </>
        )}
      </Show>
    </div>
  )
}
