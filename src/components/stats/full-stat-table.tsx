import { For } from 'solid-js'
import orchestrator from '../../libs/orchestrator/orchestrator'
import type { BsFullStatTableProps } from './full-stat-table.d'
import { STAT_COLUMNS } from './stat-columns'
import { BsStatsLegend } from './stats-legend'

export function BsFullStatTable(props: BsFullStatTableProps) {
  return (
    <div>
      <div class="overflow-x-auto">
        <table class="table-zebra table">
          <thead>
            <tr class="bg-neutral text-neutral-content">
              <For each={STAT_COLUMNS}>{(column) => <th>{column.renderHeader?.() ?? column.label}</th>}</For>
            </tr>
          </thead>
          <tbody>
            <For each={props.stats.players}>
              {(playerStats) => {
                // Skip synthetic entries without a player (e.g. game start/stop, team totals)
                if (!playerStats.playerId) {
                  return null
                }

                const player = orchestrator.getPlayer(playerStats.playerId)
                return (
                  <tr>
                    <For each={STAT_COLUMNS}>{(column) => column.renderCell(playerStats, player)}</For>
                  </tr>
                )
              }}
            </For>

            <tr>
              <For each={STAT_COLUMNS}>{(column) => column.renderCell(props.stats.teamScores)}</For>
            </tr>
          </tbody>
        </table>
      </div>
      <BsStatsLegend />
    </div>
  )
}
