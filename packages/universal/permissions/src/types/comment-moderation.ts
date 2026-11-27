/** A user acting on a channel: `ownerId` is the channel owner's user id, as the owner rules key on it. */
export interface ChannelUserResource {
  readonly channelId: string;
  readonly ownerId: string;
}

export interface CommentSettingsResource {
  readonly channelId: string;
  readonly ownerId: string;
}
