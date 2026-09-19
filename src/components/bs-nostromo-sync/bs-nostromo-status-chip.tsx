import {
  ChevronDown,
  CircleAlert,
  CircleCheckBig,
  Clock,
  KeyRound,
  LoaderCircle,
  PowerOff,
  TriangleAlert,
} from 'lucide-solid'
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type { NostromoStatus } from '../../libs/nostromo/nostromo-sync-store.d'
import {
  NOSTROMO_STATUS_CHIP_LABEL,
  NOSTROMO_STATUS_LABELS,
  NOSTROMO_STATUS_VARIANTS,
  type NostromoStatusVariant,
} from './bs-nostromo-status'
import type { BsNostromoStatusChipProps } from './bs-nostromo-sync.d'

/** Icon of each status: the same reading as the colour, for a colour-blind user. */
const STATUS_ICONS: Record<NostromoStatus, () => JSX.Element> = {
  'auth-required': () => <KeyRound size={16} />,
  conflict: () => <TriangleAlert size={16} />,
  error: () => <CircleAlert size={16} />,
  off: () => <PowerOff size={16} />,
  pending: () => <Clock size={16} />,
  saved: () => <CircleCheckBig size={16} />,
  saving: () => <LoaderCircle class="animate-spin" size={16} />,
}

/** DaisyUI colour of each variant. */
const VARIANT_CLASSES: Record<NostromoStatusVariant, string> = {
  error: 'btn-error',
  info: 'btn-info',
  neutral: 'btn-neutral',
  success: 'btn-success',
  warning: 'btn-warning',
}

/** Label, icon and chevron of the chip: shared by its button and its badge form. */
function ChipContent(props: { status: NostromoStatus }) {
  return (
    <>
      <Dynamic component={STATUS_ICONS[props.status]} />
      <span class="whitespace-nowrap">{NOSTROMO_STATUS_LABELS[props.status]}</span>
    </>
  )
}

export default function BsNostromoStatusChip(props: BsNostromoStatusChipProps) {
  const chipClass = () => `btn btn-sm gap-1.5 ${VARIANT_CLASSES[NOSTROMO_STATUS_VARIANTS[props.status]]}`
  const openPanel = () => props.onClick?.()

  return (
    <Show
      fallback={
        <span class={chipClass()}>
          <ChipContent status={props.status} />
        </span>
      }
      when={props.onClick}
    >
      <button
        aria-expanded={props.hasMenu ? Boolean(props.expanded) : undefined}
        aria-haspopup={props.hasMenu ? 'true' : undefined}
        aria-label={NOSTROMO_STATUS_CHIP_LABEL}
        class={chipClass()}
        onClick={openPanel}
        type="button"
      >
        <ChipContent status={props.status} />
        <Show when={props.hasMenu}>
          <ChevronDown class={props.expanded ? 'rotate-180 transition-transform' : 'transition-transform'} size={16} />
        </Show>
      </button>
    </Show>
  )
}
