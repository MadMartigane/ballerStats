import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import BsScoreCard from '../score-card'
import { BsMatchProps } from './match.d'

function startCounter(local: MadSignal<number>, visitor: MadSignal<number>) {
  setInterval(() => {
    const score = Math.floor(Math.random() * 199)
    local.set(score)
  }, 3000)

  setInterval(() => {
    const score = Math.floor(Math.random() * 99)
    visitor.set(score)
  }, 6666)
}

export default function BsMatch(props: BsMatchProps) {
  const matchId = props.id
  const match = orchestrator.getMatch(matchId)

  const visitorScore = new MadSignal(0)
  const localScore = new MadSignal(0)
 
  startCounter(localScore, visitorScore)
  console.log('match: ', match)

  return (
    <div class="w-full">
      <div class="w-full border border-neutral rounded bg-accent text-accent-content">
        <BsScoreCard localScore={localScore.get() || 0} visitorScore={visitorScore.get() || 0} />
      </div>
      <pre>{JSON.stringify(match, null, 4)}</pre>
    </div>
  )
}
