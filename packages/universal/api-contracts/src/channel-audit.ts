import { CHANNEL_ROLE_NAMES, COMMENT_SETTINGS_FIELDS, DISCLOSURES } from '@vp/domain';
import { z } from 'zod';

export const ChannelRoleSchema = z.enum(CHANNEL_ROLE_NAMES);

export const ProfileSchema = z
  .object({
    handle: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .describe('The person or channel as their own channel presents them');

const InviteMetaSchema = z.object({ inviteeUserId: z.uuid(), role: ChannelRoleSchema });
const MemberMetaSchema = z.object({ role: ChannelRoleSchema });
const CommentMetaSchema = z.object({ videoId: z.uuid(), disclosure: z.enum(DISCLOSURES) });
const NoMetaSchema = z.object({});

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
  auditEntry('channel.updated', 'channel', z.object({ fields: z.array(z.string()) })),
  auditEntry('video.comments.toggled', 'video', z.object({ enabled: z.boolean() })),
  auditEntry('comment.held', 'comment', CommentMetaSchema),
  auditEntry('comment.approved', 'comment', CommentMetaSchema),
  auditEntry('comment.hidden', 'comment', CommentMetaSchema),
  auditEntry('comment.unhidden', 'comment', CommentMetaSchema),
  auditEntry('comment.removed', 'comment', CommentMetaSchema),
  auditEntry('comment.pinned', 'comment', z.object({ videoId: z.uuid(), pinned: z.boolean() })),
  auditEntry('user.shadow_banned', 'user', NoMetaSchema),
  auditEntry('user.banned', 'user', z.object({ expiresAt: z.iso.datetime().nullable() })),
  auditEntry('user.restriction_lifted', 'user', z.object({ kind: z.enum(['shadow', 'ban']) })),
  auditEntry('trusted.added', 'user', NoMetaSchema),
  auditEntry('trusted.removed', 'user', NoMetaSchema),
  auditEntry(
    'settings.comments.updated',
    'settings',
    z.object({ fields: z.array(z.enum(COMMENT_SETTINGS_FIELDS)) })
  ),
]);

export const AuditPageSchema = z.object({
  items: z.array(AuditEntrySchema),
  nextCursor: z.string().nullable(),
});
