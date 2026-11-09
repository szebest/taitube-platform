import type { ChannelAuditPageView } from '@vp/api-contracts';
import type { ChannelAuditRepositoryPort, ChannelRepositoryPort } from '@vp/core/repositories';
import type { ActingChannel, ChannelAuditAction } from '@vp/domain';
import { type AuthorizationFailure, decideChannelTask } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, isErr, map } from '@vp/result';
import { profilesOf } from './channel-team-views';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';

export interface ChannelAuditServiceDeps {
  audit: Pick<ChannelAuditRepositoryPort, 'list'>;
  channels: Pick<ChannelRepositoryPort, 'findByUserIds'>;
  paginator: Paginator;
}

export interface ChannelAuditQuery {
  cursor?: string;
  limit?: number;
  actorUserId?: string;
  action?: ChannelAuditAction;
}

/** Who did what on the acting channel, newest first. Read-only: rows are written with each change. */
export class ChannelAuditService {
  constructor(private readonly deps: ChannelAuditServiceDeps) {}

  async list(
    user: UserContext,
    acting: ActingChannel,
    query: ChannelAuditQuery
  ): Promise<
    Result<ChannelAuditPageView, AuthorizationFailure | InvalidCursor | DatabaseUnavailable>
  > {
    const { audit, channels, paginator } = this.deps;

    const allowed = decideChannelTask({ user, acting, task: 'read-audit' });
    if (isErr(allowed)) return allowed;
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const limit = paginator.limit(query.limit);
    const rows = await audit.list(acting.channelId, {
      cursor: cursor.value,
      limit,
      ...(query.actorUserId && { actorUserId: query.actorUserId }),
      ...(query.action && { action: query.action }),
    });
    if (isErr(rows)) return rows;

    return map(
      await profilesOf(
        channels,
        rows.value.map(({ actorUserId }) => actorUserId)
      ),
      (profiles): ChannelAuditPageView =>
        paginator.paginate(rows.value, limit, {
          cursorOf: createdAtCursorPayload,
          toItem: ({ channelId: _channel, createdAt, ...entry }) => ({
            ...entry,
            actor: entry.actorUserId === null ? null : (profiles.get(entry.actorUserId) ?? null),
            createdAt: createdAt.toISOString(),
          }),
        })
    );
  }
}
