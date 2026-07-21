import { ChartScatter } from 'lucide-solid'
import { BsFullStatTable } from '../components/stats/full-stat-table'
import { getFullStats } from '../libs/stats/stats-util'

export default function Stats() {
  const [championshipFilter, setChampionshipFilter] = createSignal('')
  const matchVersion = createMatchVersionTracker()

  const championshipOptions = createMemo(() => {
    matchVersion() // triggers recomputation on match changes
    return getUniqueChampionships(orchestrator.Matchs.matchs)
  })
  const fullStats = createMemo(() => {
    matchVersion() // triggers recomputation on match changes
    return getFullStats(championshipFilter())
  })

  return (
    <div>
      <h1 class="font-bold text-2xl">
        <ChartScatter class="inline-block" />
        <span class="inline-block px-2">Statistiques globales sur tous les matchs.</span>
      </h1>

      <div class="mt-4 max-w-sm">
        <BsSelect
          datas={[
            { value: '', label: 'Tous les championnats' },
            ...championshipOptions().map((c) => ({ value: c, label: c })),
          ]}
          label="Championnat"
          onValueChange={(value: string) => setChampionshipFilter(value)}
          value={championshipFilter()}
        />
      </div>

      <div class="mt-4">
        <BsFullStatTable stats={fullStats()} />
      </div>
    </div>
  )
}
