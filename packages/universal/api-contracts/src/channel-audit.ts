import {
  CHANNEL_ROLE_NAMES,
  COMMENT_SETTINGS_FIELDS,
  DATA_EXPORT_FORMATS,
  DATA_EXPORT_KINDS,
  DISCLOSURES,
  POST_KINDS,
} from '@vp/domain';
import { z } from 'zod';
import { LinkPolicySchema, LinkRelationSchema, LinkStatusSchema } from './content-link-schemas';

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
const CommentMetaSchema = z.object({
  videoId: z.uuid().nullable().describe('Null for a comment on a post'),
  disclosure: z.enum(DISCLOSURES),
});
const PostMetaSchema = z.object({ kind: z.enum(POST_KINDS) });
const LinkMetaSchema = z.object({ relation: LinkRelationSchema, status: LinkStatusSchema });
const NoMetaSchema = z.object({});
const PageVersionMetaSchema = z.object({ version: z.number().int() });
const PageScheduleMetaSchema = z.object({ scheduleId: z.uuid(), publishAt: z.iso.datetime() });
const ExportMetaSchema = z.object({
  kind: z.enum(DATA_EXPORT_KINDS),
  format: z.enum(DATA_EXPORT_FORMATS),
});

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
    actorTokenId: z
      .uuid()
      .nullable()
      .describe('The personal access token the actor used; null for a session or a deleted token'),
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
  auditEntry('video.restored', 'video', z.object({ fromVersion: z.number().int() })),
  auditEntry('comment.held', 'comment', CommentMetaSchema),
  auditEntry('comment.approved', 'comment', CommentMetaSchema),
  auditEntry('comment.hidden', 'comment', CommentMetaSchema),
  auditEntry('comment.unhidden', 'comment', CommentMetaSchema),
  auditEntry('comment.removed', 'comment', CommentMetaSchema),
  auditEntry(
    'comment.pinned',
    'comment',
    z.object({ videoId: z.uuid().nullable(), pinned: z.boolean() })
  ),
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
  auditEntry('export.requested', 'export', ExportMetaSchema),
  auditEntry('export.deleted', 'export', ExportMetaSchema),
  auditEntry('channel.created', 'channel', NoMetaSchema),
  auditEntry('channel.promoted', 'channel', NoMetaSchema),
  auditEntry('comment.posted', 'comment', z.object({ videoId: z.uuid().nullable() })),
  auditEntry('channel.subscribed', 'channel', NoMetaSchema),
  auditEntry('video.uploaded', 'video', NoMetaSchema),
  auditEntry('post.published', 'post', PostMetaSchema),
  auditEntry('post.updated', 'post', PostMetaSchema),
  auditEntry('post.deleted', 'post', PostMetaSchema),
  auditEntry('link.created', 'link', LinkMetaSchema),
  auditEntry('link.approved', 'link', LinkMetaSchema),
  auditEntry('link.declined', 'link', LinkMetaSchema),
  auditEntry('link.removed', 'link', LinkMetaSchema),
  auditEntry('link.suggested', 'link', LinkMetaSchema),
  auditEntry('link.accepted', 'link', LinkMetaSchema),
  auditEntry('link.policy_changed', 'settings', z.object({ policy: LinkPolicySchema })),
  auditEntry('page.draft_saved', 'page', PageVersionMetaSchema),
  auditEntry('page.published', 'page', PageVersionMetaSchema),
  auditEntry('page.scheduled', 'page', PageScheduleMetaSchema),
  auditEntry('page.schedule_cancelled', 'page', PageScheduleMetaSchema),
  auditEntry(
    'page.restored',
    'page',
    z.object({ version: z.number().int(), fromVersion: z.number().int() })
  ),
]);

export const AuditPageSchema = z.object({
  items: z.array(AuditEntrySchema),
  nextCursor: z.string().nullable(),
});
