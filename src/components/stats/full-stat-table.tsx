import { For } from 'solid-js'
import orchestrator from '../../libs/orchestrator/orchestrator'
import type { StatMatchSummaryPlayer } from '../../libs/stats'
import type { BsFullStatTableProps } from './full-stat-table.d'
import { STAT_COLUMNS } from './stat-columns'
import { BsStatsLegend } from './stats-legend'

const TEAM_TOTAL_ROW_SEPARATOR_CLASS = 'border-base-300 border-t-2'

interface TeamRow {
  row: StatMatchSummaryPlayer
  rowClass?: string
}

export function BsFullStatTable(props: BsFullStatTableProps) {
  const teamRows = (): TeamRow[] => [
    { row: props.stats.teamScores },
    ...(props.stats.teamScoresTotal
      ? [{ row: props.stats.teamScoresTotal, rowClass: TEAM_TOTAL_ROW_SEPARATOR_CLASS }]
      : []),
  ]

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

            <For each={teamRows()}>
              {(teamRow) => (
                <tr class={teamRow.rowClass}>
                  <For each={STAT_COLUMNS}>{(column) => column.renderCell(teamRow.row)}</For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <BsStatsLegend />
    </div>
  )
}
