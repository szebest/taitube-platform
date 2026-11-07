/** One per row of the channel role matrix; an action added to the matrix adds its capability here. */
const CHANNEL_CAPABILITIES = [
  'video.read',
  'analytics.read',
  'video.edit',
  'video.delete',
  'channel.edit',
  'comment.pin',
  'content.pin',
  'comment.heart',
  'comment.moderate',
  'comment.settings',
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
    'comment.pin',
    'content.pin',
    'comment.heart',
    'comment.moderate',
    'comment.settings',
    'data.export',
    'team.manage',
  ],
  editor: ['video.read', 'analytics.read', 'video.edit', 'channel.edit', 'content.pin'],
  moderator: ['video.read', 'comment.pin', 'comment.moderate'],
  analytics: ['video.read', 'analytics.read'],
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

export const CHANNEL_AUDIT_RETENTION_DAYS = 365;

export type VideoAuditField =
  | 'title'
  | 'description'
  | 'visibility'
  | 'categoryId'
  | 'tags'
  | 'thumbnail';

/** `meta` holds ids and enum values only, never text another user wrote. */
type ChannelAuditEvent =
  | { action: 'invite.created'; targetType: 'invite'; targetId: string; meta: InviteMeta }
  | { action: 'invite.accepted'; targetType: 'invite'; targetId: string; meta: InviteMeta }
  | { action: 'invite.declined'; targetType: 'invite'; targetId: string; meta: InviteMeta }
  | { action: 'invite.revoked'; targetType: 'invite'; targetId: string; meta: InviteMeta }
  | {
      action: 'member.role_changed';
      targetType: 'member';
      targetId: string;
      meta: { from: ChannelRole; to: ChannelRole };
    }
  | { action: 'member.removed'; targetType: 'member'; targetId: string; meta: MemberMeta }
  | { action: 'member.left'; targetType: 'member'; targetId: string; meta: MemberMeta }
  | {
      action: 'video.updated';
      targetType: 'video';
      targetId: string;
      meta: { fields: VideoAuditField[] };
    };

/** Type literals, not interfaces, so a meta stays assignable to the jsonb column's record type. */
type InviteMeta = {
  inviteeUserId: string;
  role: ChannelRole;
};

type MemberMeta = {
  role: ChannelRole;
};

export type ChannelAuditAction = ChannelAuditEvent['action'];

const AUDIT_ACTIONS: Record<ChannelAuditAction, true> = {
  'invite.created': true,
  'invite.accepted': true,
  'invite.declined': true,
  'invite.revoked': true,
  'member.role_changed': true,
  'member.removed': true,
  'member.left': true,
  'video.updated': true,
};

export const CHANNEL_AUDIT_ACTIONS = Object.keys(AUDIT_ACTIONS) as ChannelAuditAction[];

/** An audit row before the store stamps its id and time; `actorUserId` is who acted, never "the channel". */
export type NewChannelAuditEntry = ChannelAuditEvent & {
  channelId: string;
  actorUserId: string;
};

/** The actor is `null` once their account is deleted; the row outlives them. */
export type ChannelAuditEntry = ChannelAuditEvent & {
  id: string;
  channelId: string;
  actorUserId: string | null;
  createdAt: Date;
};
