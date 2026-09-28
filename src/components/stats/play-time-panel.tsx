import { Timer } from 'lucide-solid'
import { For, Show } from 'solid-js'
import orchestrator from '../../libs/orchestrator/orchestrator'
import { getTheoreticalPlayerMinutes } from '../../libs/team/match-format'
import type { BsPlayTimePanelProps } from './play-time-panel.d'

/** Value shown when a player has no recorded play time (unknown, not zero). */
const UNKNOWN_PLAY_TIME = '—'
const TEAM_TOTAL_ROW_SEPARATOR_CLASS = 'border-base-300 border-t-2'

function renderMinutes(playTime: number | null): string {
  return playTime === null ? UNKNOWN_PLAY_TIME : String(Math.round(playTime))
}

function renderLegend(theoreticalMinutes: number, format: BsPlayTimePanelProps['format']): string {
  return `Valeurs approximatives, arrondies à la minute. Temps reconstruits depuis les entrées/sorties puis répartis sur un total théorique de ${theoreticalMinutes} min (${format.periods} périodes × ${format.periodLengthMinutes} min × ${format.playersOnCourt} joueurs).`
}

export function BsPlayTimePanel(props: BsPlayTimePanelProps) {
  // Synthetic summary rows (team totals, game start/stop) carry no playerId.
  const playerRows = () => props.summary.players.filter((playerStats) => Boolean(playerStats.playerId))
  const hasAnyPlayTime = () => playerRows().some((playerStats) => playerStats.playTime !== null)

  return (
    <div>
      <h3 class="flex items-center gap-1 font-bold">
        <Timer />
        Temps de jeu
      </h3>

      <Show fallback={<p class="opacity-70">Aucun temps de jeu enregistré.</p>} when={hasAnyPlayTime()}>
        <div class="overflow-x-auto print:overflow-visible">
          <table class="table-zebra table">
            <thead>
              <tr>
                <th>Joueur</th>
                <th class="text-right">Minutes</th>
              </tr>
            </thead>
            <tbody>
              <For each={playerRows()}>
                {(playerStats) => {
                  const player = orchestrator.getPlayer(playerStats.playerId)
                  return (
                    <tr>
                      <td>
                        <span class="text-xl">{player?.jerseyNumber}</span>{' '}
                        <span>{player?.nicName || player?.firstName}</span>
                        <Show when={playerStats.playTimeSource === 'table'}>
                          <span class="badge badge-ghost ml-2">feuille</span>
                        </Show>
                      </td>
                      <td class="text-right text-xl">{renderMinutes(playerStats.playTime)}</td>
                    </tr>
                  )
                }}
              </For>
              <tr class={`${TEAM_TOTAL_ROW_SEPARATOR_CLASS} font-bold`}>
                <td>Total équipe</td>
                <td class="text-right text-xl">{renderMinutes(props.summary.teamScores.playTime)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="mt-2 text-sm opacity-70">{renderLegend(getTheoreticalPlayerMinutes(props.format), props.format)}</p>
      </Show>
    </div>
  )
}
