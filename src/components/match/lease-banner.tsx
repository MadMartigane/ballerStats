import { Hand } from 'lucide-solid'
import { Show } from 'solid-js'
import type { BsLeaseBannerProps } from './lease-banner.d'

export default function BsLeaseBanner(props: BsLeaseBannerProps) {
  return (
    <div class="alert alert-warning" role="alert">
      <span>Saisie en cours par {props.holderName ?? 'un autre utilisateur'}</span>
      <Show when={props.showForceButton}>
        <button class="btn btn-sm btn-warning" onClick={props.onForce} type="button">
          <Hand />
          Prendre la main
        </button>
      </Show>
    </div>
  )
}
