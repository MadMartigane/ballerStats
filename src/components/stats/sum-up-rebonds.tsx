import type { BsStatSumUpRebondsProps } from './sum-up-rebonds.d'

export function BsStatSumUpRebonds(props: BsStatSumUpRebondsProps) {
  const statSummary = props.stats

  return (
    <div class="overflow-x-auto">
      <div class="stats shadow-xs">
        <div class="stat place-items-center">
          <div class="stat-title">Total</div>
          <div
            class={`stat-value ${statSummary.rebonds.teamTotalPercentage > 49 ? 'text-success' : 'text-warning'}`}
          >{`${statSummary.rebonds.teamTotalPercentage} %`}</div>
          <div class="stat-desc">{`Équipe (${statSummary.rebonds.teamTotal}) - Opposent (${statSummary.rebonds.opponentTotal})`}</div>
        </div>

        <div class="stat place-items-center">
          <div class="stat-title">Offensifs</div>
          <div
            class={`stat-value ${statSummary.rebonds.teamOffensivePercentage > 49 ? 'text-success' : 'text-warning'}`}
          >{`${statSummary.rebonds.teamOffensivePercentage} %`}</div>
          <div class="stat-desc">{`Équipe (${statSummary.rebonds.teamOffensive}) - Opposent (${statSummary.rebonds.opponentDefensive})`}</div>
        </div>

        <div class="stat place-items-center">
          <div class="stat-title">Defensifs</div>
          <div
            class={`stat-value ${statSummary.rebonds.teamDefensivePercentage > 49 ? 'text-success' : 'text-warning'}`}
          >{`${statSummary.rebonds.teamDefensivePercentage} %`}</div>
          <div class="stat-desc">{`Équipe (${statSummary.rebonds.teamDefensive}) - Opposent (${statSummary.rebonds.opponentOffensive})`}</div>
        </div>
      </div>
    </div>
  )
}
