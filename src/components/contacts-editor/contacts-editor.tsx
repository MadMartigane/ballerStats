import { Mail, Pencil, Phone, Plus, Save, Trash, X } from 'lucide-solid'
import { For, Show } from 'solid-js'
import Contact, { getRelationshipLabel, isContactRelationship, RELATIONSHIP_LABELS } from '../../libs/contact/contact'
import type { ContactRawData } from '../../libs/contact/contact.d'
import { createBusList } from '../../libs/event-bus/bus-hooks'
import MadSignal from '../../libs/mad-signal'
import { toast } from '../../libs/utils/utils'
import BsInput from '../input/input'
import BsSelect from '../select/select'
import type { BsContactsEditorProps } from './contacts-editor.d'

function makeContactRelationshipChangeHandler(setNewContactData: (data: Partial<ContactRawData>) => void) {
  return (value: string) => {
    if (isContactRelationship(value)) {
      setNewContactData({ relationship: value })
    }
  }
}

function makeEditContactClickHandler(editContact: (contact: Contact) => void, contact: Contact) {
  return () => {
    editContact(contact)
  }
}

function makeDeleteContactClickHandler(deleteContact: (contact: Contact) => void, contact: Contact) {
  return () => {
    deleteContact(contact)
  }
}

export default function BsContactsEditor(props: BsContactsEditorProps) {
  const isAddingContact: MadSignal<boolean> = new MadSignal(false)
  let isEditingNewContact = false
  let currentContact: Contact | null = null

  /**
   * The domain `Contacts` collection is framework-free: it only fires
   * `BS::CONTACTS::CHANGE` events on mutation. `createBusList` re-reads the
   * source list on every such event, on the source's local draft notifier, and
   * whenever the source's reactive dependencies change (staged draft signal,
   * player identity, source switch).
   */
  const visibleContacts = createBusList('BS::CONTACTS::CHANGE', () => props.source.list(), props.source.subscribe)
  const editContactLabel = 'Modifier le contact'
  const deleteContactLabel = 'Supprimer le contact'

  function startNewContact() {
    isEditingNewContact = true
    currentContact = props.source.createEmpty()
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
        props.source.add(currentContact)
      } else {
        props.source.update(currentContact)
      }
      currentContact = null
      isAddingContact.set(false)
    } catch {
      toast("Erreur lors de l'enregistrement du contact.", 'error')
    }
  }

  function deleteContact(contact: Contact) {
    try {
      props.source.remove(contact.id)
    } catch {
      toast('Erreur lors de la suppression du contact.', 'error')
    }
  }

  /**
   * Render the add/edit form for the current contact.
   *
   * It runs when the `Show` above activates, so `currentContact` is read from
   * the live binding at that moment. The local annotated alias prevents
   * TypeScript from narrowing the mutable outer variable to its `null`
   * initializer across the closure assignments.
   */
  function renderContactEditForm() {
    const editedContact: Contact | null = currentContact

    return (
      <div class="flex flex-col gap-2 rounded-lg bg-base-200 p-3">
        {BsInput({
          label: 'Nom',
          onChange: (value: string) => {
            setNewContactData({ lastName: value })
          },
          placeholder: 'Dupont',
          type: 'text',
          value: editedContact?.lastName,
        })}
        {BsInput({
          label: 'Prénom',
          onChange: (value: string) => {
            setNewContactData({ firstName: value })
          },
          placeholder: 'Charlie',
          type: 'text',
          value: editedContact?.firstName,
        })}
        <BsSelect
          datas={[...RELATIONSHIP_LABELS]}
          label="Relation"
          onValueChange={makeContactRelationshipChangeHandler(setNewContactData)}
          value={editedContact?.relationship}
        />
        {BsInput({
          label: 'Téléphone',
          onChange: (value: string) => {
            setNewContactData({ phone: value })
          },
          placeholder: '06 12 34 56 78',
          type: 'text',
          value: editedContact?.phone,
        })}
        {BsInput({
          label: 'Email',
          onChange: (value: string) => {
            setNewContactData({ email: value })
          },
          placeholder: 'contact@example.com',
          type: 'email',
          value: editedContact?.email,
        })}
        {BsInput({
          label: 'Adresse',
          onChange: (value: string) => {
            setNewContactData({ address: value })
          },
          placeholder: '12 rue du Sport, 75001 Paris',
          type: 'text',
          value: editedContact?.address,
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
    )
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

        <Show when={isAddingContact.get()}>{renderContactEditForm()}</Show>

        <Show when={!isAddingContact.get()}>
          <Show
            fallback={<p class="italic opacity-70">Aucun contact enregistré pour ce joueur.</p>}
            when={visibleContacts().length > 0}
          >
            <div class="flex flex-col gap-2">
              <For each={visibleContacts()}>
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
                        onClick={makeEditContactClickHandler(editContact, contact)}
                        type="button"
                      >
                        <Pencil />
                      </button>
                    </div>
                    <div class="tooltip tooltip-top" data-tip={deleteContactLabel}>
                      <button
                        aria-label={deleteContactLabel}
                        class="btn btn-square btn-sm"
                        onClick={makeDeleteContactClickHandler(deleteContact, contact)}
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
