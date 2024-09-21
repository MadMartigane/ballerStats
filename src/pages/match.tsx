import { useParams } from '@solidjs/router';
import BsMatch from '../components/match/match';

export default function Matchs() {
  const params = useParams();

  return (
    <div class="w-full">
      <BsMatch id={params.id} />
    </div>
  );
}
