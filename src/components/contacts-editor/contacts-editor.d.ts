import type { Accessor } from 'solid-js'
import type { ContactRawData } from '../../libs/contact/contact.d'

export interface BsContactsEditorProps {
  contacts: ContactRawData[]
  onAdd: (contact: ContactRawData) => void
  onRemove: (id: string) => void
  onUpdate: (contact: ContactRawData) => void
}

export interface ContactEditFormProps {
  draft: Accessor<ContactRawData | null>
  onCancel: () => void
  onChange: (data: Partial<ContactRawData>) => void
  onSave: () => void
}
