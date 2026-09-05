import { ChartScatter } from 'lucide-solid'
import { createMemo, createSignal } from 'solid-js'
import BsSelect from '../components/select/select'
import { BsFullStatTable } from '../components/stats/full-stat-table'
import { getUniqueChampionships } from '../libs/match/championship-util'
import Match from '../libs/match/match'
import { getFullStats } from '../libs/stats/stats-util'
import { getRawMatchs } from '../libs/stores/matchs-store'

export default function Stats() {
  const [championshipFilter, setChampionshipFilter] = createSignal('')

  const championshipOptions = createMemo(() => getUniqueChampionships(getRawMatchs().map((raw) => new Match(raw))))
  const fullStats = createMemo(() => getFullStats(championshipFilter()))

  return (
    <div>
      <h1 class="font-bold text-2xl">
        <ChartScatter class="inline-block" />
        <span class="inline-block px-2">Statistiques globales sur tous les matchs.</span>
      </h1>

      <div class="mt-4 max-w-sm">
        <BsSelect
          datas={[
            { label: 'Tous les championnats', value: '' },
            ...championshipOptions().map((c) => ({ label: c, value: c })),
          ]}
          label="Championnat"
          onValueChange={setChampionshipFilter}
          value={championshipFilter()}
        />
      </div>

      <div class="mt-4">
        <BsFullStatTable stats={fullStats()} />
      </div>
    </div>
  )
}
