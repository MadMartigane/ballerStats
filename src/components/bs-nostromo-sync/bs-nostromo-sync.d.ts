/**
 * Public props of the Nostromo synchronization UI (`src/components/bs-nostromo-sync`).
 *
 * The folder splits the same way every other feature of this app does:
 *
 * - `BsNostromoStatusChip` and `BsNostromoLogMenu` are presentational: they get
 *   the status and the log entries through props and never read a store,
 * - `BsNostromoRestoreModal` is presentational too: it displays a plan and
 *   reports the user's decision to its parent,
 * - `BsNostromoSyncCard` is the adaptor: it reads the sync stores, calls the
 *   sync libs (`client`, `nostromo-config-store`, `push-engine`, `restore`) and
 *   passes plain values down.
 */
import type { NostromoLogEntry, NostromoStatus } from '../../libs/nostromo/nostromo-sync-store.d'
import type { NostromoRestoreDecision, NostromoRestorePlan } from '../../libs/nostromo/restore.d'

/** Props of the status chip: label, colour and icon all derive from `status`. */
export interface BsNostromoStatusChipProps {
  /** True while the panel the chip controls is open: drives `aria-expanded`. */
  expanded?: boolean
  /** True when the chip opens a panel: adds a trailing chevron and `aria-haspopup`. */
  hasMenu?: boolean
  /**
   * Click handler of the chip. Without it the chip has no action to offer and is
   * rendered as a plain, non-interactive badge instead of a button.
   */
  onClick?: () => void
  /** Status to display. */
  status: NostromoStatus
}

/** Props of the app bar log panel: the caller decides how many entries it passes. */
export interface BsNostromoLogMenuProps {
  /** Entries to display, oldest first. */
  entries: NostromoLogEntry[]
  /** Called when the user follows the link to the Administration card. */
  onNavigate?: () => void
}

/** Props of the restore confirmation modal. */
export interface BsNostromoRestoreModalProps {
  /** True while an apply run is in flight: every action is disabled and a spinner is shown. */
  busy: boolean
  /** Receives the user's choice; the parent runs the confirmation. */
  onDecision: (decision: NostromoRestoreDecision) => void
  /** Plan being confirmed: its warnings and counts are displayed. */
  plan: NostromoRestorePlan
}

/** Props of the Administration card. The card is self-contained: only its heading is overridable. */
export interface BsNostromoSyncCardProps {
  /** Card heading, « Synchronisation Nostromo » by default. */
  title?: string
}
