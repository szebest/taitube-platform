import type { TrustedCommenterView } from '@vp/api-contracts';
import type {
  ChannelRepositoryPort,
  TrustedCommenterRepositoryPort,
  UserRepository,
} from '@vp/core/repositories';
import { type ActingChannel, trustAudit } from '@vp/domain';
import { type AuthorizationFailure, decideChannelTask } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, map, ok } from '@vp/result';
import { type InvalidRestriction, invalidRestriction } from '@vp/validation';
import { profilesOf } from './channel-team-views';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';

export interface TrustedCommenterServiceDeps {
  trusted: TrustedCommenterRepositoryPort;
  users: Pick<UserRepository, 'findById'>;
  channels: Pick<ChannelRepositoryPort, 'findByUserIds'>;
  paginator: Paginator;
}

export interface TrustedCommenterPage {
  items: TrustedCommenterView[];
  nextCursor: string | null;
}

export type ListTrustedFailure = AuthorizationFailure | InvalidCursor | DatabaseUnavailable;
export type TrustFailure = AuthorizationFailure | InvalidRestriction | DatabaseUnavailable;
export type UntrustFailure = AuthorizationFailure | DatabaseUnavailable;

/** Who skips the automatic holds on the acting channel; the people who may change settings manage it. */
export class TrustedCommenterService {
  constructor(private readonly deps: TrustedCommenterServiceDeps) {}

  async list(
    user: UserContext,
    acting: ActingChannel,
    query: { cursor?: string; limit?: number }
  ): Promise<Result<TrustedCommenterPage, ListTrustedFailure>> {
    const { trusted, paginator } = this.deps;
    const allowed = decideChannelTask({ user, acting, task: 'edit-comment-settings' });
    if (isErr(allowed)) return allowed;
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const limit = paginator.limit(query.limit);
    const rows = await trusted.list(acting.channelId, {
      cursor: cursor.value && { createdAt: cursor.value.createdAt, userId: cursor.value.id },
      limit,
    });
    if (isErr(rows)) return rows;

    const profiles = await profilesOf(
      this.deps.channels,
      rows.value.map(({ userId }) => userId)
    );
    return map(profiles, (found) =>
      paginator.paginate(rows.value, limit, {
        cursorOf: ({ createdAt, userId }) => createdAtCursorPayload({ createdAt, id: userId }),
        toItem: ({ userId, createdBy, createdAt }) => ({
          userId,
          createdBy,
          createdAt: createdAt.toISOString(),
          user: found.get(userId) ?? null,
        }),
      })
    );
  }

  async trust(
    user: UserContext,
    acting: ActingChannel,
    userId: string
  ): Promise<Result<void, TrustFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-comment-settings' });
    if (isErr(allowed)) return allowed;

    const target = await this.deps.users.findById(userId);
    if (isErr(target)) return target;
    if (!target.value) return err(invalidRestriction('userId', 'There is no such user', {}));

    const added = await this.deps.trusted.add(
      acting.channelId,
      userId,
      user.id,
      trustAudit({ channelId: acting.channelId, actorUserId: user.id, userId, trusted: true })
    );
    return isErr(added) ? added : ok();
  }

  async untrust(
    user: UserContext,
    acting: ActingChannel,
    userId: string
  ): Promise<Result<void, UntrustFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-comment-settings' });
    if (isErr(allowed)) return allowed;

    const removed = await this.deps.trusted.remove(
      acting.channelId,
      userId,
      trustAudit({ channelId: acting.channelId, actorUserId: user.id, userId, trusted: false })
    );
    return isErr(removed) ? removed : ok();
  }
}
