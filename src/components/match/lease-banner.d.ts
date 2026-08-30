export interface BsLeaseBannerProps {
  /** Displayed name (or email) of the current lease holder; `null` for an unknown holder. */
  holderName: string | null
  /** Triggered by the « Prendre la main » button (only rendered when `showForceButton`). */
  onForce: () => void
  /** Owner/admin can force the lease away from the current holder. */
  showForceButton: boolean
}
