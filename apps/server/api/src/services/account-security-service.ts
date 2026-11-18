import type { InvalidCursor, Paginator } from '@kit/pagination';
import { type Result, isErr, map } from '@kit/result';
import type { SignInPageView } from '@vp/api-contracts';
import type { AccountAuditRepositoryPort } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';

export interface AccountSecurityServiceDeps {
  audit: Pick<AccountAuditRepositoryPort, 'list'>;
  paginator: Paginator;
}

/** The caller's own account log; no route reads another user's rows. */
export class AccountSecurityService {
  constructor(private readonly deps: AccountSecurityServiceDeps) {}

  async signIns(
    user: UserContext,
    query: { cursor?: string; limit?: number }
  ): Promise<Result<SignInPageView, InvalidCursor | DatabaseUnavailable>> {
    const { audit, paginator } = this.deps;
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const limit = paginator.limit(query.limit);
    return map(await audit.list(user.id, { cursor: cursor.value, limit }), (rows) =>
      paginator.paginate(rows, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: ({ id, action, meta, createdAt }) => ({
          id,
          action,
          slot: meta.slot,
          userAgent: meta.userAgent,
          createdAt: createdAt.toISOString(),
        }),
      })
    );
  }
}
