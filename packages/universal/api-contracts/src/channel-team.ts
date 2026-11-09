import {
  CHANNEL_AUDIT_ACTIONS,
  CHANNEL_INVITE_STATUSES,
  CHANNEL_INVITE_TTL_DAYS,
  CHANNEL_ROLE_NAMES,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { KeysetQuerySchema } from './pagination';

const ChannelRoleSchema = z.enum(CHANNEL_ROLE_NAMES);

const InviteIdParamSchema = z.object({ id: z.uuid({ error: 'Invalid invite ID format' }) });

const MemberParamSchema = z.object({ userId: z.uuid({ error: 'Invalid user ID format' }) });

const ProfileSchema = z
  .object({
    handle: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .describe('The person or channel as their own channel presents them');

const MemberSchema = z.object({
  userId: z.uuid(),
  role: ChannelRoleSchema,
  invitedBy: z.uuid().nullable(),
  joinedAt: z.iso.datetime(),
  profile: ProfileSchema.nullable(),
});

const InviteSchema = z.object({
  id: z.uuid(),
  inviteeUserId: z.uuid(),
  role: ChannelRoleSchema,
  invitedBy: z.uuid().nullable(),
  status: z.enum(CHANNEL_INVITE_STATUSES),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  invitee: ProfileSchema.nullable(),
});

const TeamSchema = z.object({
  members: z.array(MemberSchema).describe('Oldest first; the owner is not a member'),
  invites: z.array(InviteSchema).describe('Pending and unexpired, oldest first'),
});

const MembershipSchema = z.object({
  channelId: z.uuid(),
  ownerId: z.uuid().describe("The channel owner's user id, which the permission rules key on"),
  role: ChannelRoleSchema,
  channel: ProfileSchema,
});

const MembershipListSchema = z.object({ items: z.array(MembershipSchema) });

const MyInviteSchema = z.object({
  id: z.uuid(),
  channel: z.object({ id: z.uuid() }).extend(ProfileSchema.shape),
  role: ChannelRoleSchema,
  invitedByName: z
    .string()
    .nullable()
    .describe("The inviter's display name; null once they deleted their account"),
  expiresAt: z.iso.datetime(),
});

const MyInvitePageSchema = z.object({
  items: z.array(MyInviteSchema),
  nextCursor: z.string().nullable(),
});

const InviteMetaSchema = z.object({ inviteeUserId: z.uuid(), role: ChannelRoleSchema });
const MemberMetaSchema = z.object({ role: ChannelRoleSchema });

function auditEntry<A extends string, T extends string, M extends z.ZodType>(
  action: A,
  targetType: T,
  meta: M
) {
  return z.object({
    id: z.uuid(),
    action: z.literal(action),
    targetType: z.literal(targetType),
    targetId: z.string(),
    meta,
    actorUserId: z.uuid().nullable().describe('null once the actor deleted their account'),
    actor: ProfileSchema.nullable(),
    createdAt: z.iso.datetime(),
  });
}

const AuditEntrySchema = z.discriminatedUnion('action', [
  auditEntry('invite.created', 'invite', InviteMetaSchema),
  auditEntry('invite.accepted', 'invite', InviteMetaSchema),
  auditEntry('invite.declined', 'invite', InviteMetaSchema),
  auditEntry('invite.revoked', 'invite', InviteMetaSchema),
  auditEntry(
    'member.role_changed',
    'member',
    z.object({ from: ChannelRoleSchema, to: ChannelRoleSchema })
  ),
  auditEntry('member.removed', 'member', MemberMetaSchema),
  auditEntry('member.left', 'member', MemberMetaSchema),
  auditEntry('video.updated', 'video', z.object({ fields: z.array(z.string()) })),
]);

const AuditPageSchema = z.object({
  items: z.array(AuditEntrySchema),
  nextCursor: z.string().nullable(),
});

const AuditQuerySchema = KeysetQuerySchema.extend({
  actorUserId: z.uuid().optional(),
  action: z.enum(CHANNEL_AUDIT_ACTIONS).optional(),
});

const InviteBodySchema = z.object({
  handle: z.string().min(1).describe('The handle of the invitee channel, without @'),
  role: ChannelRoleSchema,
});

const ChangeRoleBodySchema = z.object({ role: ChannelRoleSchema });

const SIGNED_IN = { 401: [ErrorCodes.UNAUTHORIZED] } as const;

const VALIDATED = { ...SIGNED_IN, 400: [ErrorCodes.VALIDATION_FAILED] } as const;

const MEMBER_TARGETED = {
  ...SIGNED_IN,
  400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.CHANNEL_OWNER_IMMUTABLE],
  404: [ErrorCodes.CHANNEL_MEMBER_NOT_FOUND],
} as const;

const TAG = 'Channel team';

export const getChannelTeam = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/members',
  channelScoped: true,
  tag: TAG,
  summary: 'List the channel team',
  description: 'The members of the acting channel and its pending invites. Owner and managers.',
  status: 200,
  result: TeamSchema,
  errors: SIGNED_IN,
});

export const createChannelInvite = defineEndpoint({
  method: 'POST',
  path: '/v1/me/channel/invites',
  channelScoped: true,
  tag: TAG,
  summary: 'Invite someone to the channel team',
  description: `Invites the account behind \`handle\` to the acting channel with \`role\`, and notifies them. The invite expires after ${CHANNEL_INVITE_TTL_DAYS} days. A manager cannot offer the manager role.`,
  body: InviteBodySchema,
  status: 201,
  result: InviteSchema,
  errors: {
    ...VALIDATED,
    404: [ErrorCodes.CHANNEL_NOT_FOUND],
    409: [ErrorCodes.CHANNEL_MEMBER_EXISTS, ErrorCodes.CHANNEL_INVITE_ALREADY_PENDING],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const revokeChannelInvite = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/channel/invites/:id',
  channelScoped: true,
  tag: TAG,
  summary: 'Revoke a pending invite',
  description: 'An invite to another channel is not found.',
  params: InviteIdParamSchema,
  status: 204,
  result: z.null().describe('Invite revoked'),
  errors: {
    ...VALIDATED,
    404: [ErrorCodes.CHANNEL_INVITE_NOT_FOUND],
    409: [ErrorCodes.CHANNEL_INVITE_NOT_PENDING],
  },
});

export const listMyInvites = defineEndpoint({
  method: 'GET',
  path: '/v1/me/invites',
  tag: TAG,
  summary: 'List the caller pending invites',
  description:
    'The invites to a channel team the caller can still answer, newest first, keyset-paginated. A declined, accepted, revoked or expired invite, and any invite sent to someone else, is never listed.',
  query: KeysetQuerySchema,
  status: 200,
  result: MyInvitePageSchema,
  errors: { ...SIGNED_IN, 400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR] },
});

export const acceptChannelInvite = defineEndpoint({
  method: 'POST',
  path: '/v1/invites/:id/accept',
  tag: TAG,
  summary: 'Accept an invite to a channel team',
  description:
    'Only the invitee answers; an invite to someone else is not found. A revoked, declined or expired invite answers 409.',
  params: InviteIdParamSchema,
  status: 200,
  result: MembershipSchema,
  errors: {
    ...VALIDATED,
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.CHANNEL_INVITE_NOT_FOUND],
    409: [ErrorCodes.CHANNEL_INVITE_NOT_PENDING],
  },
});

export const declineChannelInvite = defineEndpoint({
  method: 'POST',
  path: '/v1/invites/:id/decline',
  tag: TAG,
  summary: 'Decline an invite to a channel team',
  description: 'Only the invitee answers; an invite to someone else is not found.',
  params: InviteIdParamSchema,
  status: 204,
  result: z.null().describe('Invite declined'),
  errors: {
    ...VALIDATED,
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.CHANNEL_INVITE_NOT_FOUND],
    409: [ErrorCodes.CHANNEL_INVITE_NOT_PENDING],
  },
});

export const changeChannelMemberRole = defineEndpoint({
  method: 'PATCH',
  path: '/v1/me/channel/members/:userId',
  channelScoped: true,
  tag: TAG,
  summary: 'Change a member role',
  description:
    'A manager can neither change a manager nor give the manager role; nobody gives the owner a role.',
  params: MemberParamSchema,
  body: ChangeRoleBodySchema,
  status: 200,
  result: MemberSchema,
  errors: { ...MEMBER_TARGETED, 422: [ErrorCodes.VALIDATION_FAILED] },
});

export const removeChannelMember = defineEndpoint({
  method: 'DELETE',
  path: '/v1/me/channel/members/:userId',
  channelScoped: true,
  tag: TAG,
  summary: 'Remove a member, or leave the team',
  description:
    'The owner and managers remove members (a manager not another manager); a member removes themselves to leave, naming the channel in `X-Channel-Id`. The owner cannot be removed.',
  params: MemberParamSchema,
  status: 204,
  result: z.null().describe('Member removed'),
  errors: MEMBER_TARGETED,
});

export const listMyMemberships = defineEndpoint({
  method: 'GET',
  path: '/v1/me/memberships',
  tag: TAG,
  summary: 'List the channels the caller works on',
  description:
    'Every channel whose team the caller is on, with their role there; the caller own channel is not listed.',
  status: 200,
  result: MembershipListSchema,
  errors: SIGNED_IN,
});

export const listChannelAudit = defineEndpoint({
  method: 'GET',
  path: '/v1/me/channel/audit',
  channelScoped: true,
  tag: TAG,
  summary: 'Read the channel audit log',
  description:
    'Keyset-paginated, newest first, optionally narrowed to one actor or one action. Append-only: no route changes a row. Owner and managers.',
  query: AuditQuerySchema,
  status: 200,
  result: AuditPageSchema,
  errors: { ...SIGNED_IN, 400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR] },
});

export type ChannelTeamView = z.infer<typeof TeamSchema>;
export type ChannelMemberView = z.infer<typeof MemberSchema>;
export type ChannelInviteView = z.infer<typeof InviteSchema>;
export type ChannelMembershipView = z.infer<typeof MembershipSchema>;
export type MyInviteView = z.infer<typeof MyInviteSchema>;
export type MyInvitePageView = z.infer<typeof MyInvitePageSchema>;
export type ChannelAuditPageView = z.infer<typeof AuditPageSchema>;
export type TeamProfileView = z.infer<typeof ProfileSchema>;
