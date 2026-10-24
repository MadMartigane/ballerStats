/**
 * Public props of the Nostromo synchronization UI (`src/components/bs-nostromo-sync`).
 *
 * The folder splits the same way every other feature of this app does:
 *
 * - `BsNostromoStatusChip` and `BsNostromoLogMenu` are presentational: they get
 *   the status and the log entries through props and never read a store,
 * - `BsNostromoRestoreModal`, `BsNostromoConflictModal` and `BsNostromoOpenPullModal`
 *   are presentational too: they display a plan or a choice and report the user's
 *   decision to their parent,
 * - `BsNostromoSyncCard` is the adaptor: it reads the sync stores, calls the
 *   sync libs (`client`, `nostromo-config-store`, `push-engine`, `restore`) and
 *   passes plain values down.
 */
import type { ConflictChoice } from '../../libs/nostromo/conflict-resolution'
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
  /**
   * Host of the configured server (`localhost:8090`), shown as the plan source.
   * Absent when the app is unconfigured: the line is then not rendered.
   */
  host?: string
  /** Receives the user's choice; the parent runs the confirmation. */
  onDecision: (decision: NostromoRestoreDecision) => void
  /** Plan being confirmed: its warnings and counts are displayed. */
  plan: NostromoRestorePlan
}

/** Props of the per-unit conflict modal. */
export interface BsNostromoConflictModalProps {
  /** True while a resolution is in flight: every action is disabled. */
  busy: boolean
  /** Closes the modal without resolving anything. */
  onClose: () => void
  /** Reports the choice made for one parked unit; the parent confirms and resolves. */
  onResolve: (unit: string, choice: ConflictChoice) => void
  /** Parked units, one entry per collection. */
  units: string[]
}

/** Props of the Administration card. The card is self-contained: only its heading is overridable. */
export interface BsNostromoSyncCardProps {
  /** Card heading, « Synchronisation Nostromo » by default. */
  title?: string
}

/** Props of the modal shown when the open pull finds unsynced local data. */
export interface BsNostromoOpenPullModalProps {
  /** True while an action is in flight: every action is disabled. */
  busy: boolean
  /** « Garder mes données »: skips the pull and keeps the pending changes. */
  onKeepLocal: () => void
  /** « Envoyer d'abord (réessayer) »: flushes, then pulls again. */
  onRetry: () => void
  /** « Prendre celles du serveur »: the parent confirms and resolves each unit. */
  onTakeServer: () => void
  /** Units that still hold unsent changes. */
  units: string[]
}
