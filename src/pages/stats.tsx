import BsFullStatTable from "../components/stats"
import { getFullStats } from "../libs/stats/stats-util"

export default function Stats() {
  const fullStats = getFullStats()

  console.log("fullStats: ", fullStats)

  return (
    <div>
      <h1 class="text-2xl font-bold">Get your full stats !!</h1>

      <BsFullStatTable stats={fullStats} />
      <pre>{JSON.stringify(fullStats, null, 2)}</pre>
    </div>
  )
}
