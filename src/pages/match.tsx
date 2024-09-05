import { useParams } from '@solidjs/router'
import { goBack } from '../libs/utils'
import { ChevronLeft } from 'lucide-solid'
import BsMatch from '../components/match/match'

export default function Matchs() {
  const params = useParams()

  return (
    <div class="w-full">
      <div class="w-full py-1">
        <button
          class="btn btn-secondary btn-xs"
          onClick={() => {
            goBack()
          }}
        >
          <ChevronLeft />
          Retour
        </button>
      </div>
      <div class="w-full">
        <BsMatch id={params.id} />
      </div>
    </div>
  )
}
