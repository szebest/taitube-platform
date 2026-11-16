/** `userId` is who the token acts as; only they list or revoke it. */
export interface ApiTokenResource {
  readonly userId: string;
}
