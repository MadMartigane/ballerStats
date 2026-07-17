import Contact from '../../contact'
import type { ContactRawData } from '../../contact/contact.d'
import { nextId } from '../mock-counter'

const ID_PREFIX = 'mock-contact'

/** Build a deterministic Contact. Defaults satisfy isRegisterable (playerId set). */
export function makeContact(overrides: Partial<ContactRawData> = {}): Contact {
  const raw: ContactRawData = {
    playerId: 'mock-player-1',
    firstName: 'Contact',
    lastName: 'Mock',
    relationship: 'other',
    ...overrides,
    id: overrides.id ?? nextId(ID_PREFIX),
  }
  return new Contact(raw)
}
