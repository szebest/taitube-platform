/** `ownerId` is the user who owns the stream's channel: the one account that may broadcast on it. */
export interface LiveStreamResource {
  readonly ownerId?: string;
}
