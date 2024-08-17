import { useParams } from "@solidjs/router";

export default function Matchs() {
  const params = useParams();

  return (
    <div>
      <span>User id: {params.id}</span>
    </div>
  )
}
