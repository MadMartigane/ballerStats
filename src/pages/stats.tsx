import { ChartScatter } from 'lucide-solid'
import { BsFullStatTable } from '../components/stats'
import { getFullStats } from '../libs/stats/stats-util'

export default function Stats() {
  const fullStats = getFullStats()

  return (
    <div>
      <h1 class="text-2xl font-bold">
        <ChartScatter class="inline-block" />
        <span class="inline-block px-2">Statistiques globales sur tous les matchs.</span>
      </h1>

      <div class="mt-4">
        <BsFullStatTable stats={fullStats} />
      </div>
    </div>
  )
}
