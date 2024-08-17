import orchestrator from '../../libs/orchestrator/orchestrator'
import { BsMatchProps } from './match.d'

export default function BsMatch(props: BsMatchProps) {
  const matchId = props.id
  const match = orchestrator.getMatch(matchId)

  console.log('match: ', match)

  return (
    <div class='w-full border rounded border-zinc-50 dark:border-zinc-950'>
      <pre>{JSON.stringify(match, null, 4)}</pre>
    </div>
  )
}
