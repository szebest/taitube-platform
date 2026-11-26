import type { InvalidCursor, Paginator } from '@kit/pagination';
import { type Result, isErr, map } from '@kit/result';
import type { SignInPageView, SignInView } from '@vp/api-contracts';
import type { AccountAuditRepositoryPort } from '@vp/core/repositories';
import { type AccountAuditEntry, accountAuditMeta } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';

export interface AccountSecurityServiceDeps {
  audit: AccountAuditRepositoryPort;
  paginator: Paginator;
}

function signInView({ id, action, meta, createdAt }: AccountAuditEntry): SignInView {
  return {
    id,
    action,
    slot: meta.slot,
    userAgent: meta.userAgent,
    createdAt: createdAt.toISOString(),
  };
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
        toItem: signInView,
      })
    );
  }

  /** A sign-in into a browser slot, with the token that slot now holds. */
  async recordSignIn(
    user: UserContext,
    { slot, userAgent }: { slot: number; userAgent: string | undefined }
  ): Promise<Result<SignInView, DatabaseUnavailable>> {
    const appended = await this.deps.audit.append({
      userId: user.id,
      action: 'account.signed_in',
      meta: accountAuditMeta(slot, userAgent),
    });
    return map(appended, signInView);
  }
}
