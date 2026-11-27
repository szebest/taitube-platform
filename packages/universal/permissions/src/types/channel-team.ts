import type { ChannelRole } from '@vp/domain';

/** `ownerId` is the channel owner's user id: the owner rules key on it. */
interface ChannelTeamSubject {
  readonly channelId: string;
  readonly ownerId: string;
}

export interface ChannelMemberResource extends ChannelTeamSubject {
  readonly userId?: string;
  readonly role?: ChannelRole;
}

export interface ChannelInviteResource extends ChannelTeamSubject {
  readonly inviteeUserId?: string;
  readonly role?: ChannelRole;
}

export type ChannelAuditResource = ChannelTeamSubject;
