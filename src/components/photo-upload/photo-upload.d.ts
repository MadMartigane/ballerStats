export type BsPhotoUploadProps = {
  playerId: string
  hasPhoto: boolean
  /**
   * Called when the user adds, updates, or deletes a photo.
   *
   * Contract:
   * - When `blob` is present: a new photo was selected (add or replace).
   *   `hasPhoto` will be `true`.
   * - When `blob` is absent and `hasPhoto` is `false`: the user requested deletion
   *   of the existing photo.
   * - The parent is responsible for persisting or discarding the blob and updating
   *   the player's `hasPhoto` flag accordingly.
   */
  onChange: (hasPhoto: boolean, blob?: Blob) => void
}
