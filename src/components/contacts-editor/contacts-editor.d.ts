import type { ContactRawData } from '../../libs/contact/contact.d'

export interface BsContactsEditorProps {
  contacts: ContactRawData[]
  onAdd: (contact: ContactRawData) => void
  onRemove: (id: string) => void
  onUpdate: (contact: ContactRawData) => void
}
