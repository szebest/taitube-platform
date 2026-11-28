/** A link's channel end: the source channel for `link`, the target channel for approving and removing. */
export interface ContentLinkResource {
  readonly ownerId: string;
  readonly channelId: string;
}
