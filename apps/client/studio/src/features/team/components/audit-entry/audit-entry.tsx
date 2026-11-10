import { Link } from '@tanstack/react-router';
import type { ChannelAuditPageView } from '@vp/api-contracts';
import { VIDEO_AUDIT_FIELDS } from '@vp/domain';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { assertNever } from '@vp/result';
import { AuditLogList } from '#app/components/team/audit-log-list';
import { RoleBadge } from '#app/components/team/role-badge';

export type AuditEntryView = ChannelAuditPageView['items'][number];

const videoFieldsOf = (fields: readonly string[]) =>
  VIDEO_AUDIT_FIELDS.filter((known) => fields.includes(known));

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
    case 'channel.updated':
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
        <AuditLogList.Actor>{actor}</AuditLogList.Actor>
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
