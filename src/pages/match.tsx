import { Router, useParams } from '@solidjs/router'
import BsButton from '../components/button'
import { goBack } from '../libs/utils'
import { ChevronLeft } from 'lucide-solid'
import BsMatch from '../components/match/match'

export default function Matchs() {
  const params = useParams()

  return (
    <div class="w-full">
      <BsButton
        size="sm"
        onClick={() => {
          goBack()
        }}
      >
        <ChevronLeft />
        Retour
      </BsButton>
      <div class="w-full">
        <BsMatch id={params.id} />
      </div>
    </div>
  )
}
