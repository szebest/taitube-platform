export interface ChannelResource {
  readonly id?: string;
  readonly userId?: string;
  readonly ownerId?: string;
}

export type ChannelAction = 'channel:update' | 'channel:manage' | 'channel:subscribe';
