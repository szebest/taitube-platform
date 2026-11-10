import type { OwnRestrictionView, RestrictionActionBody, RestrictionView } from '@vp/api-contracts';
import type { CommentCachePort } from '@vp/core/ports';
import type {
  ChannelMemberRepositoryPort,
  ChannelRepositoryPort,
  ChannelUserRestrictionRepositoryPort,
  CommentModerationRepositoryPort,
  NotificationRepositoryPort,
  UserRepository,
} from '@vp/core/repositories';
import {
  type ActingChannel,
  type ChannelUserRestriction,
  type NewChannelUserRestriction,
  liftAudit,
  restrictionAudit,
} from '@vp/domain';
import {
  type AuthorizationFailure,
  type ChannelUserRestrictionFailure,
  type RestrictionNotFound,
  decideChannelTask,
  decideChannelUserRestriction,
  restrictionNotFound,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, err, ignore, isErr, map, ok } from '@vp/result';
import { type InvalidRestriction, invalidRestriction, validateBan } from '@vp/validation';
import { type Profiles, profilesOf } from './channel-team-views';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';

export interface ChannelRestrictionServiceDeps {
  restrictions: ChannelUserRestrictionRepositoryPort;
  members: Pick<ChannelMemberRepositoryPort, 'listByChannel'>;
  users: Pick<UserRepository, 'findById'>;
  channels: Pick<ChannelRepositoryPort, 'findByUserIds'>;
  moderation: Pick<CommentModerationRepositoryPort, 'idsByAuthor'>;
  notifications: Pick<NotificationRepositoryPort, 'withdrawUnread'>;
  commentCache: CommentCachePort;
  paginator: Paginator;
  now: () => number;
}

export interface RestrictionPage {
  items: RestrictionView[];
  nextCursor: string | null;
}

export type ListRestrictionsFailure = AuthorizationFailure | InvalidCursor | DatabaseUnavailable;
export type RestrictUserFailure =
  | ChannelUserRestrictionFailure
  | InvalidRestriction
  | DatabaseUnavailable;
export type LiftRestrictionFailure =
  | AuthorizationFailure
  | RestrictionNotFound
  | DatabaseUnavailable;
export type OwnRestrictionFailure = RestrictionNotFound | DatabaseUnavailable;

function toView(restriction: ChannelUserRestriction, profiles: Profiles): RestrictionView {
  const { userId, kind, reason, expiresAt, createdBy, createdAt } = restriction;
  return {
    userId,
    kind,
    reason,
    expiresAt: expiresAt?.toISOString() ?? null,
    createdBy,
    createdAt: createdAt.toISOString(),
    user: profiles.get(userId) ?? null,
  };
}

/** Shadow bans and bans on the acting channel: who may restrict, and what a change keeps true. */
export class ChannelRestrictionService {
  constructor(private readonly deps: ChannelRestrictionServiceDeps) {}

  async list(
    user: UserContext,
    acting: ActingChannel,
    query: { cursor?: string; limit?: number }
  ): Promise<Result<RestrictionPage, ListRestrictionsFailure>> {
    const { restrictions, paginator } = this.deps;
    const allowed = decideChannelTask({ user, acting, task: 'restrict-users' });
    if (isErr(allowed)) return allowed;
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const limit = paginator.limit(query.limit);
    const rows = await restrictions.list(acting.channelId, {
      cursor: cursor.value && { createdAt: cursor.value.createdAt, userId: cursor.value.id },
      limit,
      now: new Date(this.deps.now()),
    });
    if (isErr(rows)) return rows;

    const profiles = await profilesOf(
      this.deps.channels,
      rows.value.map(({ userId }) => userId)
    );
    return map(profiles, (found) =>
      paginator.paginate(rows.value, limit, {
        cursorOf: ({ createdAt, userId }) => createdAtCursorPayload({ createdAt, id: userId }),
        toItem: (row) => toView(row, found),
      })
    );
  }

  async restrict(
    user: UserContext,
    acting: ActingChannel,
    targetUserId: string,
    body: RestrictionActionBody
  ): Promise<Result<RestrictionView, RestrictUserFailure>> {
    const { restrictions, members, users } = this.deps;
    const { channelId, ownerId } = acting;

    const team = await members.listByChannel(channelId);
    if (isErr(team)) return team;
    const decided = decideChannelUserRestriction({
      actor: user,
      channel: { channelId, ownerId },
      targetUserId,
      targetIsMember: team.value.some((member) => member.userId === targetUserId),
    });
    if (isErr(decided)) return decided;

    const target = await users.findById(targetUserId);
    if (isErr(target)) return target;
    if (!target.value) return err(invalidRestriction('userId', 'There is no such user', {}));

    const restriction = this.restrictionOf(user, channelId, targetUserId, body);
    if (isErr(restriction)) return restriction;

    const written = await restrictions.apply(restriction.value, {
      audit: restrictionAudit({
        channelId,
        actorUserId: user.id,
        userId: targetUserId,
        restriction: restriction.value,
      }),
      ...(body.action === 'ban' && {
        notice: {
          userId: targetUserId,
          action: 'ban',
          channelId,
          videoId: null,
          commentId: null,
          reason: restriction.value.reason,
          expiresAt: restriction.value.expiresAt?.toISOString() ?? null,
          excerpt: null,
        },
      }),
    });
    if (isErr(written)) return written;

    const aftermath = await this.settle(written.value.videoIds, ownerId, targetUserId, body.action);
    if (isErr(aftermath)) return aftermath;

    const profiles = await profilesOf(this.deps.channels, [targetUserId]);
    return map(profiles, (found) => toView(written.value.restriction, found));
  }

  async lift(
    user: UserContext,
    acting: ActingChannel,
    targetUserId: string
  ): Promise<Result<void, LiftRestrictionFailure>> {
    const { restrictions } = this.deps;
    const { channelId } = acting;
    const allowed = decideChannelTask({ user, acting, task: 'restrict-users' });
    if (isErr(allowed)) return allowed;

    const current = await restrictions.findActive(
      channelId,
      targetUserId,
      new Date(this.deps.now())
    );
    if (isErr(current)) return current;
    if (!current.value) return err(restrictionNotFound(targetUserId));

    const lifted = await restrictions.lift(
      channelId,
      targetUserId,
      liftAudit({
        channelId,
        actorUserId: user.id,
        userId: targetUserId,
        kind: current.value.kind,
      })
    );
    if (isErr(lifted)) return lifted;
    if (!lifted.value.lifted) return err(restrictionNotFound(targetUserId));

    await this.purge(lifted.value.videoIds);
    return ok();
  }

  /** A shadow ban is never told, so a ban or none is the only thing a user may read of themselves. */
  async ownBan(
    user: UserContext,
    channelId: string
  ): Promise<Result<OwnRestrictionView, OwnRestrictionFailure>> {
    const found = await this.deps.restrictions.findActive(
      channelId,
      user.id,
      new Date(this.deps.now())
    );
    if (isErr(found)) return found;
    if (found.value?.kind !== 'ban') return err(restrictionNotFound(user.id));

    const { reason, expiresAt } = found.value;
    return ok({ reason, expiresAt: expiresAt?.toISOString() ?? null });
  }

  private restrictionOf(
    actor: UserContext,
    channelId: string,
    userId: string,
    body: RestrictionActionBody
  ): Result<NewChannelUserRestriction, InvalidRestriction> {
    const base = { channelId, userId, createdBy: actor.id };
    if (body.action === 'shadow_ban') {
      return ok({ ...base, kind: 'shadow', reason: null, expiresAt: null });
    }

    const ban = validateBan(
      {
        reason: body.reason ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
      new Date(this.deps.now())
    );
    return map(ban, (valid): NewChannelUserRestriction => ({ ...base, kind: 'ban', ...valid }));
  }

  /** What a shadow ban takes out of public reads leaves the cache and the bell too. */
  private async settle(
    videoIds: readonly string[],
    ownerId: string,
    userId: string,
    action: RestrictionActionBody['action']
  ): Promise<Result<void, DatabaseUnavailable>> {
    await this.purge(videoIds);
    if (action !== 'shadow_ban') return ok();

    const comments = await this.deps.moderation.idsByAuthor(userId, ownerId);
    if (isErr(comments)) return comments;
    const withdrawn = await this.deps.notifications.withdrawUnread(comments.value);
    return isErr(withdrawn) ? withdrawn : ok();
  }

  private async purge(videoIds: readonly string[]): Promise<void> {
    for (const videoId of videoIds) {
      ignore(
        await this.deps.commentCache.invalidate(videoId),
        'the write is committed; the hot page expires on its own TTL'
      );
    }
  }
}
