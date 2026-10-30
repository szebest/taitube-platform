import type { MarkNotificationsReadBody, Notification } from '@vp/api-contracts';
import { readScopeOf } from '@vp/api-contracts';
import type { NotificationRepositoryPort } from '@vp/core/repositories';
import { type NotificationFilter, toNotificationView } from '@vp/domain';
import { type AuthorizationFailure, decideNotificationAccess } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { isErr, map, ok, type Result } from '@vp/result';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';

export interface NotificationServiceDeps {
  notifications: NotificationRepositoryPort;
  paginator: Paginator;
}

export interface NotificationPage {
  items: Notification[];
  nextCursor: string | null;
}

type ReadNotificationsFailure = AuthorizationFailure | DatabaseUnavailable;

/** The bell: the caller's own notifications, listed newest first and marked read. */
export class NotificationService {
  constructor(private readonly deps: NotificationServiceDeps) {}

  async list(
    viewer: UserContext,
    options: { filter: NotificationFilter; cursor?: string; limit?: number }
  ): Promise<Result<NotificationPage, ReadNotificationsFailure | InvalidCursor>> {
    const allowed = decideNotificationAccess({ actor: viewer, ownerId: viewer.id, action: 'read' });
    if (isErr(allowed)) return allowed;

    const { paginator, notifications } = this.deps;
    const limit = paginator.limit(options.limit);
    const cursor = decodeCreatedAtCursor(options.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await notifications.list(viewer.id, {
      filter: options.filter,
      cursor: cursor.value ?? undefined,
      limit,
    });
    return map(rows, (found) =>
      paginator.paginate(found, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: toNotificationView,
      })
    );
  }

  async unreadCount(
    viewer: UserContext
  ): Promise<Result<{ unreadCount: number }, ReadNotificationsFailure>> {
    const allowed = decideNotificationAccess({ actor: viewer, ownerId: viewer.id, action: 'read' });
    if (isErr(allowed)) return allowed;

    return map(await this.deps.notifications.unreadCount(viewer.id), (unreadCount) => ({
      unreadCount,
    }));
  }

  /** An id of someone else's notification refuses the whole request; an id that is gone is skipped. */
  async markRead(
    editor: UserContext,
    body: MarkNotificationsReadBody
  ): Promise<Result<{ unreadCount: number }, ReadNotificationsFailure>> {
    const scope = readScopeOf(body);
    const owners =
      scope.scope === 'ids' ? await this.deps.notifications.findByIds(scope.ids) : ok([]);
    if (isErr(owners)) return owners;

    for (const ownerId of [editor.id, ...owners.value.map((found) => found.userId)]) {
      const allowed = decideNotificationAccess({ actor: editor, ownerId, action: 'update' });
      if (isErr(allowed)) return allowed;
    }

    return map(await this.deps.notifications.markRead(editor.id, scope), ({ unreadCount }) => ({
      unreadCount,
    }));
  }
}
