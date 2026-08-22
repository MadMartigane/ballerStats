import { Camera, Trash2, User } from 'lucide-solid'
import { createMemo, createResource, createSignal, Show } from 'solid-js'
import { compressPhoto } from '../../libs/photo-compressor/photo-compressor'
import { getPhoto } from '../../libs/photo-store/photo-store'
import { useBlobUrl } from '../../libs/photo-store/use-blob-url'
import { toast } from '../../libs/utils/utils'
import type { BsPhotoUploadProps } from './photo-upload.d'

function makeFileInputClickHandler(getFileInput: () => HTMLInputElement | undefined) {
  return () => {
    getFileInput()?.click()
  }
}

export default function BsPhotoUpload(props: BsPhotoUploadProps) {
  const [pendingBlob, setPendingBlob] = createSignal<Blob | undefined>(undefined)
  const [isDeleted, setIsDeleted] = createSignal(false)
  const pendingBlobUrl = useBlobUrl(() => pendingBlob())
  // biome-ignore lint/suspicious/noUnassignedVariables: SolidJS assigns refs directly via the ref prop, so the variable is written outside regular JS.
  let fileInputRef: HTMLInputElement | undefined

  const [existingPhoto] = createResource(
    () => (props.hasPhoto && !isDeleted() ? props.playerId : null),
    async (id) => (id ? getPhoto(id) : undefined)
  )

  const existingPhotoUrl = useBlobUrl(() => (props.hasPhoto && !isDeleted() ? existingPhoto() : undefined))

  async function handleFileChange(event: Event & { currentTarget: HTMLInputElement }) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) {
      return
    }

    try {
      const compressed = await compressPhoto(file)
      setPendingBlob(compressed)
      setIsDeleted(false)
      props.onChange(true, compressed)
    } catch {
      toast('Impossible de compresser la photo.', 'error')
    }

    input.value = ''
  }

  function handleDelete() {
    setPendingBlob(undefined)
    setIsDeleted(true)
    props.onChange(false)
  }

  const displayUrl = createMemo(() => pendingBlobUrl() || existingPhotoUrl())

  return (
    <div class="flex flex-col items-center gap-2">
      <Show
        fallback={
          <div class="flex h-20 w-20 items-center justify-center rounded-full border-2 border-base-300 border-dashed bg-base-200">
            <User class="h-8 w-8 text-base-content/30" />
          </div>
        }
        when={displayUrl()}
      >
        <img alt="Aperçu" class="h-20 w-20 rounded-full object-cover" height={80} src={displayUrl()} width={80} />
      </Show>

      <div class="flex flex-row gap-2">
        <button class="btn btn-primary btn-sm" onClick={makeFileInputClickHandler(() => fileInputRef)} type="button">
          <Camera class="h-4 w-4" />
          {pendingBlob() || (props.hasPhoto && !isDeleted()) ? 'Changer' : 'Ajouter'}
        </button>

        <Show when={pendingBlob() || (props.hasPhoto && !isDeleted())}>
          <button class="btn btn-error btn-sm" onClick={handleDelete} type="button">
            <Trash2 class="h-4 w-4" />
            Supprimer
          </button>
        </Show>
      </div>

      <input accept="image/*" class="hidden" onChange={handleFileChange} ref={fileInputRef} type="file" />
    </div>
  )
}
