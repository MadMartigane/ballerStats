import type Contact from '../contact/contact'
import type Player from '../player/player'
import type Team from '../team/team'

/**
 * Slugify a team name for safe use in a filename.
 * Strips accents via NFD normalization and replaces non-alphanumeric runs with dashes.
 * Returns an empty string for null/undefined/blank input.
 */
export function slugifyTeamName(name: string | null | undefined): string {
  if (!name) {
    return ''
  }

  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Collect all available email addresses for a team, preserving team.playerIds order.
 *
 * For each player (in team order):
 *  - includes the player's own email when set
 *  - includes each contact email where contact.playerId === player.id
 *
 * Values are trimmed, empties filtered out, and duplicates removed
 * (case-insensitive on the trimmed value, original casing preserved).
 */
export function collectTeamEmails(team: Team, players: Player[], contacts: Contact[]): string[] {
  const playersById = new Map<string, Player>()
  for (const player of players) {
    playersById.set(player.id, player)
  }

  const contactsByPlayerId = new Map<string, Contact[]>()
  for (const contact of contacts) {
    // Contacts without a playerId cannot be linked to a team player, so they
    // never contribute to the exported email list (same as before: they were
    // grouped under an unreachable `undefined` key).
    if (!contact.playerId) {
      continue
    }
    const list = contactsByPlayerId.get(contact.playerId)
    if (list) {
      list.push(contact)
    } else {
      contactsByPlayerId.set(contact.playerId, [contact])
    }
  }

  const candidates: string[] = []
  for (const playerId of team.playerIds) {
    const player = playersById.get(playerId)
    if (player?.email) {
      candidates.push(player.email)
    }

    for (const contact of contactsByPlayerId.get(playerId) ?? []) {
      if (contact.email) {
        candidates.push(contact.email)
      }
    }
  }

  return dedupeTrimmedEmails(candidates)
}

/** Deduplicate emails case-insensitively on the trimmed value, preserving original casing. Drop empty values. */
function dedupeTrimmedEmails(emails: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const email of emails) {
    const trimmed = email.trim()
    if (!trimmed) {
      continue
    }
    const key = trimmed.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(trimmed)
    }
  }
  return result
}
