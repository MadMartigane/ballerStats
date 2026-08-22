import type Player from '../../libs/player/player'

export interface BsTrombiProps {
  /** Route target for the "Retour" button. Defaults to ROUTE_PLAYERS. */
  backRoute?: string
  /** Players to display (mandatory — caller decides the source). */
  players: Player[]
  /**
   * Team name area.
   * - Omitted (undefined): editable title (global view).
   * - string | null: read-only; null renders the "Équipe sans nom" placeholder.
   */
  staticTeamName?: string | null
}
