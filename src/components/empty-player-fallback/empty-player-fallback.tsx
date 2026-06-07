import { MessageCircleWarning } from 'lucide-solid'

export default function BsEmptyPlayerFallback() {
  return (
    <div>
      <h4 class="my-4 inline-flex items-end">
        <MessageCircleWarning class="h-14 w-14" />
        <span class="px-2">Aucun joueur enregistré.</span>
      </h4>
    </div>
  )
}
