export type BsPlayerRawData = {
  id: number
  firstName: string | null
  lastName: string | null
  jersayNumber: string | null // We have to make the diff between 00 and 0, 01 and 1, etc.
  licenseNumber: string | null
  nicName?: string
  birthDay?: string
  // TODO: id photo
}
