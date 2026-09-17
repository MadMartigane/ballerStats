/**
 * Persisted Nostromo client configuration.
 *
 * Token-only authentication: the token returned by
 * `POST /api/collections/users/auth-with-password` is the only credential kept
 * on the client. The account password MUST NEVER appear in this shape, in
 * localStorage, in logs or in console output (SDK integration guide, section 4.8).
 */
export interface NostromoConfig {
  /** Backend origin, without a trailing slash (e.g. `https://nostromo.example.com`). */
  baseUrl: string
  /** Account email, display only: used to greet the user, never to authenticate again. */
  email: string
  /** Raw token sent as the `Authorization` header value, never with a `Bearer ` prefix. */
  token: string
  /** Id of the authenticated user: every document is created with `owner = userId`. */
  userId: string
}
