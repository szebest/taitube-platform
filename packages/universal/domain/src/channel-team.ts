/** One per row of the channel role matrix; an action added to the matrix adds its capability here. */
export const CHANNEL_CAPABILITIES = [
  'video.read',
  'analytics.read',
  'video.edit',
  'video.delete',
  'channel.edit',
  'channel.act',
  'comment.pin',
  'content.pin',
  'post.manage',
  'content.link',
  'link.approve',
  'comment.heart',
  'comment.moderate',
  'comment.settings',
  'analytics.export',
  'data.export',
  'team.manage',
  'channel.own',
] as const;

export type ChannelCapability = (typeof CHANNEL_CAPABILITIES)[number];

/** The four fixed roles and what each may do; the owner holds every capability and is no member row. */
const CHANNEL_ROLES = {
  manager: [
    'video.read',
    'analytics.read',
    'video.edit',
    'video.delete',
    'channel.edit',
    'channel.act',
    'comment.pin',
    'content.pin',
    'post.manage',
    'content.link',
    'link.approve',
    'comment.heart',
    'comment.moderate',
    'comment.settings',
    'analytics.export',
    'data.export',
    'team.manage',
  ],
  editor: [
    'video.read',
    'analytics.read',
    'video.edit',
    'channel.edit',
    'content.pin',
    'post.manage',
    'content.link',
  ],
  moderator: ['video.read', 'comment.pin', 'comment.moderate'],
  analytics: ['video.read', 'analytics.read', 'analytics.export'],
} as const satisfies Record<string, readonly ChannelCapability[]>;

export type ChannelRole = keyof typeof CHANNEL_ROLES;

export const CHANNEL_ROLE_NAMES = Object.keys(CHANNEL_ROLES) as ChannelRole[];

export type ActingRole = 'owner' | ChannelRole;

export function roleHas(role: ActingRole, capability: ChannelCapability): boolean {
  if (role === 'owner') return true;
  const granted: readonly ChannelCapability[] = CHANNEL_ROLES[role];
  return granted.includes(capability);
}

export interface ChannelMembership {
  channelId: string;
  userId: string;
  role: ChannelRole;
  invitedBy: string | null;
  createdAt: Date;
}

/** A membership as a request sees it: the channel, its owner's user id and the caller's role on it. */
export interface MemberChannel {
  channelId: string;
  ownerId: string;
  role: ChannelRole;
}

/** The channel a studio request acts on; the caller's own channel unless `X-Channel-Id` names another. */
export interface ActingChannel {
  channelId: string;
  ownerId: string;
  role: ActingRole;
}

export const CHANNEL_INVITE_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'revoked',
  'expired',
] as const;

export type ChannelInviteStatus = (typeof CHANNEL_INVITE_STATUSES)[number];

export const CHANNEL_INVITE_TTL_DAYS = 14;

export interface ChannelInvite {
  id: string;
  channelId: string;
  inviteeUserId: string;
  role: ChannelRole;
  invitedBy: string | null;
  status: ChannelInviteStatus;
  createdAt: Date;
  expiresAt: Date;
}
