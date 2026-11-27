import { Format } from '@kit/intl-react';
import { assertNever } from '@kit/result';
import { Badge } from '@kit/ui';
import { Link } from '@tanstack/react-router';
import type { ChannelAuditPageView } from '@vp/api-contracts';
import { COMMENT_SETTINGS_FIELDS, VIDEO_AUDIT_FIELDS } from '@vp/domain';
import { publishedAt } from '@vp/intl-formats';
import { AuditLogList } from '#app/components/team/audit-log-list';
import { RoleBadge } from '#app/components/team/role-badge';
import { useT } from '#app/lib/messages';

export type AuditEntryView = ChannelAuditPageView['items'][number];

const videoFieldsOf = (fields: readonly string[]) =>
  VIDEO_AUDIT_FIELDS.filter((known) => fields.includes(known));

const settingsFieldsOf = (fields: readonly string[]) =>
  COMMENT_SETTINGS_FIELDS.filter((known) => fields.includes(known));

function AuditDetail({ entry }: { entry: AuditEntryView }) {
  const { tOr } = useT();

  switch (entry.action) {
    case 'invite.created':
    case 'invite.accepted':
    case 'invite.declined':
    case 'invite.revoked':
    case 'member.removed':
    case 'member.left':
      return (
        <RoleBadge channelRole={entry.meta.role}>
          {tOr('studio.teamRole', { role: entry.meta.role }, '')}
        </RoleBadge>
      );
    case 'member.role_changed':
      return (
        <AuditLogList.Detail>
          {tOr('studio.teamAuditRoleChanged', { from: entry.meta.from, to: entry.meta.to }, '')}
        </AuditLogList.Detail>
      );
    case 'video.updated':
      return (
        <AuditLogList.Detail>
          <Link to="/videos/$videoId/edit" params={{ videoId: entry.targetId }}>
            {tOr(
              'studio.teamAuditVideoFields',
              {
                fields: videoFieldsOf(entry.meta.fields).map((field) =>
                  tOr('studio.teamAuditField', { field }, field)
                ),
              },
              ''
            )}
          </Link>
        </AuditLogList.Detail>
      );
    case 'video.comments.toggled':
      return (
        <AuditLogList.Detail>
          {tOr('studio.teamAuditCommentsToggled', { state: entry.meta.enabled ? 'on' : 'off' }, '')}
        </AuditLogList.Detail>
      );
    case 'video.restored':
      return (
        <AuditLogList.Detail>
          <Link to="/videos/$videoId/edit" params={{ videoId: entry.targetId }}>
            {tOr('studio.teamAuditRestored', { version: entry.meta.fromVersion }, '')}
          </Link>
        </AuditLogList.Detail>
      );
    case 'comment.held':
    case 'comment.approved':
    case 'comment.hidden':
    case 'comment.unhidden':
    case 'comment.removed':
      return (
        <AuditLogList.Detail>
          {tOr('studio.teamAuditDisclosure', { disclosure: entry.meta.disclosure }, '')}
        </AuditLogList.Detail>
      );
    case 'comment.pinned':
      return (
        <AuditLogList.Detail>
          {tOr('studio.teamAuditPinned', { state: entry.meta.pinned ? 'on' : 'off' }, '')}
        </AuditLogList.Detail>
      );
    case 'settings.comments.updated':
      return (
        <AuditLogList.Detail>
          {tOr(
            'studio.teamAuditSettingsFields',
            {
              fields: settingsFieldsOf(entry.meta.fields).map((field) =>
                tOr('studio.teamAuditSettingsField', { field }, field)
              ),
            },
            ''
          )}
        </AuditLogList.Detail>
      );
    case 'export.requested':
    case 'export.deleted':
      return (
        <AuditLogList.Detail>
          {tOr('studio.teamAuditExport', { kind: entry.meta.kind, format: entry.meta.format }, '')}
        </AuditLogList.Detail>
      );
    case 'user.shadow_banned':
    case 'user.banned':
    case 'user.restriction_lifted':
    case 'trusted.added':
    case 'trusted.removed':
    case 'channel.updated':
    case 'channel.created':
    case 'channel.promoted':
    case 'comment.posted':
    case 'channel.subscribed':
    case 'video.uploaded':
    case 'post.published':
    case 'post.updated':
    case 'post.deleted':
      return null;
    default:
      return assertNever(entry, 'ChannelAuditAction');
  }
}

/** One audit row: who did it, what, to what, and when, the actor being the member who acted and never the channel. */
export function AuditEntry({ entry }: { entry: AuditEntryView }) {
  const { tOr } = useT();
  const actor = entry.actor?.displayName ?? tOr('studio.teamAuditDeletedActor', {}, '');

  return (
    <AuditLogList.Item>
      <AuditLogList.Avatar name={actor} imageUrl={entry.actor?.avatarUrl} />
      <AuditLogList.Body>
        <AuditLogList.Actor>
          {actor}
          {entry.actorTokenId && (
            <Badge size="sm" variant="outline" className="ms-inline">
              {tOr('studio.teamAuditViaToken', {}, '')}
            </Badge>
          )}
        </AuditLogList.Actor>
        <AuditLogList.Action>
          {tOr('studio.teamAuditAction', { action: entry.action }, '')}
          <AuditDetail entry={entry} />
        </AuditLogList.Action>
      </AuditLogList.Body>
      <AuditLogList.Time dateTime={entry.createdAt}>
        <Format value={publishedAt(entry.createdAt).relative} />
      </AuditLogList.Time>
    </AuditLogList.Item>
  );
}
