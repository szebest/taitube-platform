/** A channel's post, or the stats of one: the channel's grants decide, so it carries the owner and the channel. */
export interface PostResource {
  readonly ownerId: string;
  readonly channelId: string;
}
