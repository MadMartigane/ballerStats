import { Shirt, Users } from 'lucide-solid'
import { For } from 'solid-js'
import orchestrator from '../../libs/orchestrator/orchestrator'
import type Player from '../../libs/player'
import type { StatMatchSummaryPlayer } from '../../libs/stats'
import type { BsFullStatTableProps } from './full-stat-table.d'

function renderTh(playerStats: StatMatchSummaryPlayer, player?: Player | null) {
  return (
    <tr>
      <th>
        <span class="text-2xl">{player?.jersayNumber || <Users size={28} />}</span>
      </th>
      <td class="text-xl">{player?.nicName ? player.nicName : player?.firstName || 'Équipe'}</td>
      <td>
        <span class="text-lg">{`${playerStats.scores.total}`}</span>
      </td>
      <td>
        <div class="text-lg">{playerStats.rebonds.total}</div>
        <span>{`(${playerStats.rebonds.offensive} - ${playerStats.rebonds.defensive})`}</span>
      </td>
      <td>
        <span class="text-lg">{playerStats.fouls}</span>
      </td>
      <td>
        <span class="text-lg">{playerStats.turnover}</span>
      </td>
      <td>
        <span class="text-lg">{playerStats.assists}</span>
      </td>
      <td>
        <span class="text-lg">{`${playerStats.scores['free-throw']}`}</span>
        {` ${playerStats.ratio['free-throw'].success}/${playerStats.ratio['free-throw'].total}`}
        <div>{`(${playerStats.ratio['free-throw'].percentage}%)`}</div>
      </td>
      <td>
        <span class="text-lg">{`${playerStats.scores['2pts']}`}</span>
        {` ${playerStats.ratio['2pts'].success}/${playerStats.ratio['2pts'].total}`}
        <div>{`(${playerStats.ratio['2pts'].percentage}%)`}</div>
      </td>
      <td>
        <span class="text-lg">{`${playerStats.scores['3pts']}`}</span>
        {` ${playerStats.ratio['3pts'].success}/${playerStats.ratio['3pts'].total}`}
        <div>{`(${playerStats.ratio['3pts'].percentage}%)`}</div>
      </td>
    </tr>
  )
}

export function BsFullStatTable(props: BsFullStatTableProps) {
  const statSummary = props.stats

  return (
    <div>
      <div class="overflow-x-auto">
        <table class="table table-zebra">
          <thead>
            <tr class="bg-neutral text-neutral-content">
              <th>
                <Shirt />
              </th>
              <th>Nom</th>
              <th>Pts</th>
              <th>Rbs (O-D)</th>
              <th>Fautes</th>
              <th>
                <div>TO</div>
              </th>
              <th>
                <div>Ass</div>
              </th>
              <th>LF</th>
              <th>2pts</th>
              <th>3pts</th>
            </tr>
          </thead>
          <tbody>
            <For each={statSummary.players}>
              {(playerStats) => {
                /* Is a global stat like stop and start game, not a player stat */
                if (!playerStats.playerId) {
                  return null
                }

                const player = orchestrator.getPlayer(playerStats.playerId)
                return renderTh(playerStats, player)
              }}
            </For>

            {renderTh(statSummary.teamScores)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
