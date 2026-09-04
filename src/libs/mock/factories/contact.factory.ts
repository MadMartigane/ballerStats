import Contact from '../../contact/contact'
import type { ContactRawData } from '../../contact/contact.d'
import { nextId } from '../mock-counter'

const ID_PREFIX = 'mock-contact'

/** Build a deterministic Contact. Defaults satisfy isRegisterable (playerId set). */
export function makeContact(overrides: Partial<ContactRawData> = {}): Contact {
  const raw: ContactRawData = {
    firstName: 'Contact',
    lastName: 'Mock',
    playerId: 'mock-player-1',
    relationship: 'other',
    ...overrides,
    id: overrides.id ?? nextId(ID_PREFIX),
  }
  return new Contact(raw)
}
