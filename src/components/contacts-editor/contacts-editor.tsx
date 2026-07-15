import { Mail, Pencil, Phone, Plus, Save, Trash, X } from 'lucide-solid'
import { createMemo, For, Show } from 'solid-js'
import Contact, {
  type ContactRawData,
  getRelationshipLabel,
  isContactRelationship,
  RELATIONSHIP_LABELS,
} from '../../libs/contact'
import { contacts as allContacts } from '../../libs/contacts-store'
import MadSignal from '../../libs/mad-signal'
import orchestrator from '../../libs/orchestrator/orchestrator'
import { toast } from '../../libs/utils'
import BsInput from '../input'
import BsSelect from '../select/select'
import type { BsContactsEditorProps } from './contacts-editor.d'

function BsContactsEditor(props: BsContactsEditorProps) {
  const isAddingContact: MadSignal<boolean> = new MadSignal(false)
  let isEditingNewContact = false
  let currentContact: Contact | null = null

  const playerContacts = createMemo(() => allContacts.filter((c) => c.playerId === props.playerId))
  const editContactLabel = 'Modifier le contact'
  const deleteContactLabel = 'Supprimer le contact'

  function startNewContact() {
    isEditingNewContact = true
    currentContact = new Contact({ playerId: props.playerId, relationship: 'mother' })
    isAddingContact.set(true)
  }

  function editContact(contact: Contact) {
    isEditingNewContact = false
    currentContact = new Contact(contact.getRawData())
    isAddingContact.set(true)
  }

  function cancelContactEdit() {
    currentContact = null
    isAddingContact.set(false)
  }

  function setNewContactData(data: Partial<ContactRawData>) {
    if (!currentContact) {
      return
    }
    currentContact.update(data)
  }

  function registerContact() {
    if (!currentContact) {
      return
    }
    try {
      if (isEditingNewContact) {
        orchestrator.Contacts.add(currentContact)
      } else {
        orchestrator.Contacts.updateContact(currentContact)
      }
      currentContact = null
      isAddingContact.set(false)
    } catch {
      toast("Erreur lors de l'enregistrement du contact.", 'error')
    }
  }

  function deleteContact(contact: Contact) {
    try {
      orchestrator.Contacts.remove(contact)
    } catch {
      toast('Erreur lors de la suppression du contact.', 'error')
    }
  }

  return (
    <>
      <hr class="my-2" />
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-lg">Contacts</h3>
          <Show when={!isAddingContact.get()}>
            <button class="btn btn-primary btn-sm" onClick={startNewContact} type="button">
              <Plus />
              Ajouter
            </button>
          </Show>
        </div>

        <Show when={isAddingContact.get()}>
          <div class="flex flex-col gap-2 rounded-lg bg-base-200 p-3">
            {BsInput({
              type: 'text',
              label: 'Nom',
              value: currentContact?.lastName,
              placeholder: 'Dupont',
              onChange: (value: string) => {
                setNewContactData({ lastName: value })
              },
            })}
            {BsInput({
              type: 'text',
              label: 'Prénom',
              value: currentContact?.firstName,
              placeholder: 'Charlie',
              onChange: (value: string) => {
                setNewContactData({ firstName: value })
              },
            })}
            <BsSelect
              datas={RELATIONSHIP_LABELS}
              label="Relation"
              onValueChange={(value: string) => {
                if (isContactRelationship(value)) {
                  setNewContactData({ relationship: value })
                }
              }}
              value={currentContact?.relationship}
            />
            {BsInput({
              type: 'text',
              label: 'Téléphone',
              value: currentContact?.phone,
              placeholder: '06 12 34 56 78',
              onChange: (value: string) => {
                setNewContactData({ phone: value })
              },
            })}
            {BsInput({
              type: 'email',
              label: 'Email',
              value: currentContact?.email,
              placeholder: 'contact@example.com',
              onChange: (value: string) => {
                setNewContactData({ email: value })
              },
            })}
            {BsInput({
              type: 'text',
              label: 'Adresse',
              value: currentContact?.address,
              placeholder: '12 rue du Sport, 75001 Paris',
              onChange: (value: string) => {
                setNewContactData({ address: value })
              },
            })}
            <div class="footer-buttons-container">
              <button class="btn btn-primary btn-wide" onClick={cancelContactEdit} type="button">
                <X />
                Annuler
              </button>
              <button class="btn btn-primary btn-wide" onClick={registerContact} type="button">
                <Save />
                Enregistrer
              </button>
            </div>
          </div>
        </Show>

        <Show when={!isAddingContact.get()}>
          <Show
            fallback={<p class="italic opacity-70">Aucun contact enregistré pour ce joueur.</p>}
            when={playerContacts().length > 0}
          >
            <div class="flex flex-col gap-2">
              <For each={playerContacts()}>
                {(contact) => (
                  <div class="flex items-center gap-2 rounded-lg bg-base-200 p-3">
                    <div class="flex flex-1 flex-col gap-1">
                      <span class="font-medium">
                        {contact.firstName} {contact.lastName}
                      </span>
                      <span class="text-sm opacity-70">{getRelationshipLabel(contact.relationship)}</span>
                      <Show when={contact.phone}>
                        <span class="flex items-center gap-1 text-sm">
                          <Phone class="size-4" />
                          {contact.phone}
                        </span>
                      </Show>
                      <Show when={contact.email}>
                        <span class="flex items-center gap-1 text-sm">
                          <Mail class="size-4" />
                          {contact.email}
                        </span>
                      </Show>
                    </div>
                    <div class="tooltip tooltip-top" data-tip={editContactLabel}>
                      <button
                        aria-label={editContactLabel}
                        class="btn btn-square btn-sm"
                        onClick={() => editContact(contact)}
                        type="button"
                      >
                        <Pencil />
                      </button>
                    </div>
                    <div class="tooltip tooltip-top" data-tip={deleteContactLabel}>
                      <button
                        aria-label={deleteContactLabel}
                        class="btn btn-square btn-sm"
                        onClick={() => deleteContact(contact)}
                        type="button"
                      >
                        <Trash />
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </>
  )
}

export default BsContactsEditor
