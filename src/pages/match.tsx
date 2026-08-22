import { useParams } from '@solidjs/router'
import BsMatch from '../components/match/match'

export default function Matchs() {
  const params = useParams()

  return (
    <div class="w-full">
      {/* The /match/:id route guarantees a param, so the fallback never surfaces. */}
      <BsMatch id={params.id ?? ''} />
    </div>
  )
}
