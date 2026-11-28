import type { PostKind } from './channel-post';
import type { RestrictionKind } from './channel-restriction';
import type { ChannelRole } from './channel-team';
import type { CommentSettingsField, Disclosure } from './comment-settings';
import type { ContentLinkRelation, ContentLinkStatus, LinkPolicy } from './content-link';
import type { DataExportFormat, DataExportKind } from './data-export';

export const CHANNEL_AUDIT_RETENTION_DAYS = 365;

export const VIDEO_AUDIT_FIELDS = [
  'title',
  'description',
  'visibility',
  'categoryId',
  'tags',
  'thumbnail',
  'chapters',
] as const;

export type VideoAuditField = (typeof VIDEO_AUDIT_FIELDS)[number];

const CHANNEL_AUDIT_FIELDS = ['handle', 'avatar', 'banner', 'spotlight'] as const;

export type ChannelAuditField = (typeof CHANNEL_AUDIT_FIELDS)[number];

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
    }
  | { action: 'video.comments.toggled'; targetType: 'video'; targetId: string; meta: ToggledMeta }
  | {
      action: 'video.restored';
      targetType: 'video';
      targetId: string;
      meta: { fromVersion: number };
    }
  | { action: 'comment.held'; targetType: 'comment'; targetId: string; meta: CommentMeta }
  | { action: 'comment.approved'; targetType: 'comment'; targetId: string; meta: CommentMeta }
  | { action: 'comment.hidden'; targetType: 'comment'; targetId: string; meta: CommentMeta }
  | { action: 'comment.unhidden'; targetType: 'comment'; targetId: string; meta: CommentMeta }
  | { action: 'comment.removed'; targetType: 'comment'; targetId: string; meta: CommentMeta }
  | { action: 'comment.pinned'; targetType: 'comment'; targetId: string; meta: PinnedMeta }
  | { action: 'user.shadow_banned'; targetType: 'user'; targetId: string; meta: UserMeta }
  | { action: 'user.banned'; targetType: 'user'; targetId: string; meta: BanMeta }
  | { action: 'user.restriction_lifted'; targetType: 'user'; targetId: string; meta: LiftMeta }
  | { action: 'trusted.added'; targetType: 'user'; targetId: string; meta: UserMeta }
  | { action: 'trusted.removed'; targetType: 'user'; targetId: string; meta: UserMeta }
  | {
      action: 'settings.comments.updated';
      targetType: 'settings';
      targetId: string;
      meta: { fields: CommentSettingsField[] };
    }
  | {
      action: 'channel.updated';
      targetType: 'channel';
      targetId: string;
      meta: { fields: ChannelAuditField[] };
    }
  | { action: 'export.requested'; targetType: 'export'; targetId: string; meta: ExportMeta }
  | { action: 'export.deleted'; targetType: 'export'; targetId: string; meta: ExportMeta }
  | { action: 'channel.created'; targetType: 'channel'; targetId: string; meta: UserMeta }
  | { action: 'channel.promoted'; targetType: 'channel'; targetId: string; meta: UserMeta }
  | { action: 'comment.posted'; targetType: 'comment'; targetId: string; meta: PostedMeta }
  | { action: 'channel.subscribed'; targetType: 'channel'; targetId: string; meta: UserMeta }
  | { action: 'video.uploaded'; targetType: 'video'; targetId: string; meta: UserMeta }
  | { action: 'post.published'; targetType: 'post'; targetId: string; meta: PostMeta }
  | { action: 'post.updated'; targetType: 'post'; targetId: string; meta: PostMeta }
  | { action: 'post.deleted'; targetType: 'post'; targetId: string; meta: PostMeta }
  | { action: 'link.created'; targetType: 'link'; targetId: string; meta: LinkMeta }
  | { action: 'link.approved'; targetType: 'link'; targetId: string; meta: LinkMeta }
  | { action: 'link.declined'; targetType: 'link'; targetId: string; meta: LinkMeta }
  | { action: 'link.removed'; targetType: 'link'; targetId: string; meta: LinkMeta }
  | { action: 'link.suggested'; targetType: 'link'; targetId: string; meta: LinkMeta }
  | { action: 'link.accepted'; targetType: 'link'; targetId: string; meta: LinkMeta }
  | {
      action: 'link.policy_changed';
      targetType: 'settings';
      targetId: string;
      meta: { policy: LinkPolicy };
    }
  | { action: 'page.draft_saved'; targetType: 'page'; targetId: string; meta: PageVersionMeta }
  | { action: 'page.published'; targetType: 'page'; targetId: string; meta: PageVersionMeta }
  | { action: 'page.scheduled'; targetType: 'page'; targetId: string; meta: PageScheduleMeta }
  | {
      action: 'page.schedule_cancelled';
      targetType: 'page';
      targetId: string;
      meta: PageScheduleMeta;
    }
  | { action: 'page.restored'; targetType: 'page'; targetId: string; meta: PageRestoreMeta };

/** Type literals, not interfaces, so a meta stays assignable to the jsonb column's record type. */
type InviteMeta = {
  inviteeUserId: string;
  role: ChannelRole;
};

type MemberMeta = {
  role: ChannelRole;
};

type ToggledMeta = { enabled: boolean };

type CommentMeta = { videoId: string | null; disclosure: Disclosure };

type PinnedMeta = { videoId: string | null; pinned: boolean };

type PostedMeta = { videoId: string | null };

type UserMeta = Record<never, never>;

type PostMeta = { kind: PostKind };

type LinkMeta = { relation: ContentLinkRelation; status: ContentLinkStatus };
type PageVersionMeta = { version: number };

type PageScheduleMeta = { scheduleId: string; publishAt: string };

type PageRestoreMeta = { version: number; fromVersion: number };

type BanMeta = { expiresAt: string | null };

type LiftMeta = { kind: RestrictionKind };

type ExportMeta = { kind: DataExportKind; format: DataExportFormat };

export type ChannelAuditAction = ChannelAuditEvent['action'];

type VideoAuditEvent = Extract<ChannelAuditEvent, { targetType: 'video' }>;

/**
 * One edit is audited as what changed in its fields and, on its own row, a comments toggle; a
 * restore adds a row naming the version it went back to.
 */
export function videoEditAudit(edit: {
  videoId: string;
  fields: VideoAuditField[];
  commentsEnabled?: boolean;
  restoredFromVersion?: number;
}): VideoAuditEvent[] {
  const { videoId: targetId, fields, commentsEnabled, restoredFromVersion } = edit;
  const events: VideoAuditEvent[] = [];
  if (restoredFromVersion !== undefined) {
    events.push({
      action: 'video.restored',
      targetType: 'video',
      targetId,
      meta: { fromVersion: restoredFromVersion },
    });
  }
  if (fields.length > 0) {
    events.push({ action: 'video.updated', targetType: 'video', targetId, meta: { fields } });
  }
  if (commentsEnabled !== undefined) {
    events.push({
      action: 'video.comments.toggled',
      targetType: 'video',
      targetId,
      meta: { enabled: commentsEnabled },
    });
  }
  return events;
}

const AUDIT_ACTIONS: Record<ChannelAuditAction, true> = {
  'invite.created': true,
  'invite.accepted': true,
  'invite.declined': true,
  'invite.revoked': true,
  'member.role_changed': true,
  'member.removed': true,
  'member.left': true,
  'video.updated': true,
  'video.comments.toggled': true,
  'video.restored': true,
  'comment.held': true,
  'comment.approved': true,
  'comment.hidden': true,
  'comment.unhidden': true,
  'comment.removed': true,
  'comment.pinned': true,
  'user.shadow_banned': true,
  'user.banned': true,
  'user.restriction_lifted': true,
  'trusted.added': true,
  'trusted.removed': true,
  'settings.comments.updated': true,
  'channel.updated': true,
  'export.requested': true,
  'export.deleted': true,
  'channel.created': true,
  'channel.promoted': true,
  'comment.posted': true,
  'channel.subscribed': true,
  'video.uploaded': true,
  'post.published': true,
  'post.updated': true,
  'post.deleted': true,
  'link.created': true,
  'link.approved': true,
  'link.declined': true,
  'link.removed': true,
  'link.suggested': true,
  'link.accepted': true,
  'link.policy_changed': true,
  'page.draft_saved': true,
  'page.published': true,
  'page.scheduled': true,
  'page.schedule_cancelled': true,
  'page.restored': true,
};

export const CHANNEL_AUDIT_ACTIONS = Object.keys(AUDIT_ACTIONS) as ChannelAuditAction[];

/** Who acted, never "the channel"; a write made with a personal access token also names the token. */
export interface AuditActor {
  actorUserId: string;
  actorTokenId?: string;
}

/** An audit row before the store stamps its id and time. */
export type NewChannelAuditEntry = ChannelAuditEvent & AuditActor & { channelId: string };

/** The actor is `null` once their account is deleted, the token once it is; the row outlives both. */
export type ChannelAuditEntry = ChannelAuditEvent & {
  id: string;
  channelId: string;
  actorUserId: string | null;
  actorTokenId: string | null;
  createdAt: Date;
};

export function scheduleAppliedAudit(schedule: {
  channelId: string;
  createdBy: string | null;
}): ((version: number) => NewChannelAuditEntry) | null {
  const { channelId, createdBy } = schedule;
  return createdBy
    ? (version) => ({
        channelId,
        actorUserId: createdBy,
        action: 'page.published',
        targetType: 'page',
        targetId: channelId,
        meta: { version },
      })
    : null;
}
